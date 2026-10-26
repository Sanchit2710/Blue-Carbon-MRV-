"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { CHAIN_ID, REGISTRY_ADDRESS } from "@/lib/chain/config";
import { batchIdOf, dayToSeconds, projectIdOf, toHundredths } from "@/lib/chain/ids";
import { registryEvents } from "@/lib/chain/server";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export type IssuancePlan = {
  batchId: string; projectId: string; onchainProjectId: string; owner: string; registered: boolean;
  periodStart: string; periodEnd: string; methodology: string; verificationRef: string; quantity: string; onchainBatchId: string;
};

const issueSchema = z.object({
  projectId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(10_000_000),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  methodology: z.string().trim().min(3).max(200),
  verificationRef: z.string().trim().min(3).max(200),
});

// Step 1: validate and create (or reuse) the off-chain batch, and return the exact on-chain arguments.
export async function prepareIssuance(input: z.input<typeof issueSchema>): Promise<Result<IssuancePlan>> {
  await requireRole("admin");
  const p = issueSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const v = p.data;
  if (v.periodEnd <= v.periodStart) return fail("The crediting period must end after it starts.");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, status, onchain_owner, organizations(wallet_address)").eq("id", v.projectId).single();
  if (!project) return fail("Project not found.");
  if (project.status !== "approved") return fail("Only approved projects can receive credits.");
  const owner = project.onchain_owner ?? (project.organizations as unknown as { wallet_address: string | null } | null)?.wallet_address;
  if (!owner) return fail("The organisation hasn’t linked a wallet yet. Ask them to connect MetaMask on their dashboard.");

  const onchainProjectId = projectIdOf(v.projectId);
  const start = dayToSeconds(v.periodStart), end = dayToSeconds(v.periodEnd);
  const onchainBatchId = batchIdOf(onchainProjectId, start, end).toString();
  const quantity = toHundredths(v.quantity);

  const { data: existing } = await supabase.from("credit_batches").select("id, issued_qty").eq("onchain_batch_id", onchainBatchId).maybeSingle();
  let batchId = existing?.id as string | undefined;
  if (existing && Number(existing.issued_qty) > 0) return fail("Credits for this project and crediting period are already issued.");
  if (!batchId) {
    const { data, error } = await supabase.from("credit_batches").insert({
      project_id: v.projectId, methodology: v.methodology, verification_ref: v.verificationRef,
      period_start: v.periodStart, period_end: v.periodEnd, proposed_qty: v.quantity, approved_qty: v.quantity,
      onchain_batch_id: onchainBatchId, chain_id: CHAIN_ID,
    }).select("id").single();
    if (error) return fail(error.message.includes("duplicate") ? "A batch for this crediting period already exists." : error.message);
    batchId = data.id;
  } else {
    await supabase.from("credit_batches").update({ methodology: v.methodology, verification_ref: v.verificationRef, proposed_qty: v.quantity, approved_qty: v.quantity }).eq("id", batchId);
  }
  return { ok: true, data: {
    batchId: batchId!, projectId: v.projectId, onchainProjectId, owner, registered: !!project.onchain_owner,
    periodStart: start.toString(), periodEnd: end.toString(), methodology: v.methodology, verificationRef: v.verificationRef,
    quantity: quantity.toString(), onchainBatchId,
  } };
}

// Step 2: remember a transaction the verifier just sent, so a refresh or crash doesn't lose it.
export async function recordTransaction(input: { hash: string; kind: "register" | "issue"; projectId: string; batchId?: string; from: string }): Promise<Result<null>> {
  await requireRole("admin");
  if (!hash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  const supabase = await createClient();
  const { error } = await supabase.from("blockchain_transactions").insert({
    chain_id: CHAIN_ID, tx_hash: input.hash, kind: input.kind, status: "pending", from_address: input.from,
    to_address: REGISTRY_ADDRESS, project_id: input.projectId, batch_id: input.batchId ?? null,
  });
  return error ? fail(error.message) : { ok: true, data: null };
}

async function settle(txHash: string, status: "confirmed" | "failed", error?: string) {
  const supabase = await createClient();
  await supabase.from("blockchain_transactions").update({ status, error: error ?? null, confirmed_at: status === "confirmed" ? new Date().toISOString() : null }).eq("tx_hash", txHash);
}

// Step 3a: confirm the project registration from the receipt, not from the browser's word.
export async function confirmRegistration(input: { hash: string; projectId: string }): Promise<Result<null>> {
  await requireRole("admin");
  if (!hash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, organizations(wallet_address)").eq("id", input.projectId).single();
  const wallet = (project?.organizations as unknown as { wallet_address: string | null } | null)?.wallet_address;
  const onchainProjectId = projectIdOf(input.projectId);
  try {
    const { events } = await registryEvents(input.hash);
    const ev = events.find((e) => e.name === "ProjectRegistered" && e.args.projectId === onchainProjectId);
    if (!ev) throw new Error("No ProjectRegistered event for this project in that transaction");
    if (!wallet || String(ev.args.owner).toLowerCase() !== wallet.toLowerCase()) throw new Error("Registered owner doesn’t match the organisation’s wallet");
    await supabase.from("projects").update({ onchain_project_id: onchainProjectId, onchain_owner: String(ev.args.owner) }).eq("id", input.projectId);
    await settle(input.hash, "confirmed");
    await supabase.rpc("log_audit", { p_action: "project.register_onchain", p_entity: "project", p_entity_id: input.projectId, p_detail: { tx: input.hash, owner: String(ev.args.owner) } });
    return { ok: true, data: null };
  } catch (e) {
    await settle(input.hash, "failed", (e as Error).message);
    return fail((e as Error).message);
  }
}

// Step 3b: confirm issuance: the BatchIssued event must match the batch we prepared, field by field.
export async function confirmIssuance(input: { hash: string; batchId: string }): Promise<Result<null>> {
  await requireRole("admin");
  if (!hash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  const supabase = await createClient();
  const { data: batch } = await supabase.from("credit_batches").select("id, project_id, approved_qty, onchain_batch_id, projects(onchain_owner)").eq("id", input.batchId).single();
  if (!batch) return fail("Batch not found.");
  try {
    const { events } = await registryEvents(input.hash);
    const ev = events.find((e) => e.name === "BatchIssued" && e.args.batchId.toString() === batch.onchain_batch_id);
    if (!ev) throw new Error("No BatchIssued event for this batch in that transaction");
    const owner = (batch.projects as unknown as { onchain_owner: string | null } | null)?.onchain_owner;
    if (ev.args.projectId !== projectIdOf(batch.project_id)) throw new Error("Project mismatch in the issued batch");
    if (ev.args.quantity !== toHundredths(Number(batch.approved_qty))) throw new Error("Issued quantity doesn’t match the approved quantity");
    if (!owner || String(ev.args.to).toLowerCase() !== owner.toLowerCase()) throw new Error("Credits were minted to an unexpected address");
    await supabase.from("credit_batches").update({ issued_qty: batch.approved_qty }).eq("id", batch.id);
    await settle(input.hash, "confirmed");
    await supabase.rpc("log_audit", { p_action: "credits.issue", p_entity: "credit_batch", p_entity_id: batch.id, p_detail: { tx: input.hash, quantity: batch.approved_qty } });
    revalidatePath(`/admin/projects/${batch.project_id}`);
    return { ok: true, data: null };
  } catch (e) {
    await settle(input.hash, "failed", (e as Error).message);
    return fail((e as Error).message);
  }
}

// MetaMask rejected or the send failed before a hash existed: nothing to record on-chain.
export async function abandonBatch(batchId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("credit_batches").delete().eq("id", batchId).eq("issued_qty", 0);
}
