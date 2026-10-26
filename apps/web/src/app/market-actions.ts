"use server";

import { formatEther } from "ethers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { CHAIN_ID } from "@/lib/chain/config";
import { marketEvents, readMarket, registryEvents } from "@/lib/chain/server";
import { ethPerTonne, tonnes } from "@/lib/chain/units";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const audit = (actor: string, action: string, entity: string, id: string, detail: object) =>
  adminClient().from("audit_logs").insert({ actor_id: actor, action, entity, entity_id: id, detail });

// Batch row as seen by the signed-in user (RLS), with its project's organisation.
async function batchFor(batchId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("credit_batches").select("id, project_id, onchain_batch_id, projects(name, organization_id)").eq("id", batchId).single();
  return data as unknown as { id: string; project_id: string; onchain_batch_id: string; projects: { name: string; organization_id: string } } | null;
}

// NGO listed credits: confirm the Listed event, then record the listing.
export async function confirmListing(input: { hash: string; batchId: string }): Promise<Result<null>> {
  const p = await requireRole("ngo");
  if (!txHash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  const batch = await batchFor(input.batchId);
  if (!batch || batch.projects.organization_id !== p.org?.id) return fail("Batch not found for your organisation.");
  try {
    const { events } = await marketEvents(input.hash);
    const ev = events.find((e) => e.name === "Listed" && e.args.batchId.toString() === batch.onchain_batch_id);
    if (!ev) throw new Error("No Listed event for this batch in that transaction");
    if (!same(ev.args.seller, p.org.wallet_address)) throw new Error("Listed from a wallet that isn’t your organisation’s");
    const db = adminClient();
    const { data, error } = await db.from("marketplace_listings").upsert({
      batch_id: batch.id, seller_org_id: p.org.id, quantity_available: tonnes(ev.args.quantity), price_per_credit: ethPerTonne(ev.args.pricePerUnit),
      price_wei_per_unit: ev.args.pricePerUnit.toString(), onchain_listing_id: Number(ev.args.listingId), seller_address: ev.args.seller,
      chain_id: CHAIN_ID, tx_hash: input.hash, active: true,
    }, { onConflict: "tx_hash" }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(p.id, "listing.create", "marketplace_listing", data.id, { tx: input.hash });
    revalidatePath(`/ngo/projects/${batch.project_id}`);
    return { ok: true, data: null };
  } catch (e) { return fail((e as Error).message); }
}

export async function confirmCancel(input: { hash: string; listingId: string }): Promise<Result<null>> {
  const p = await requireRole("ngo");
  if (!txHash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  const db = adminClient();
  const { data: l } = await db.from("marketplace_listings").select("id, seller_org_id, onchain_listing_id, batch_id").eq("id", input.listingId).single();
  if (!l || l.seller_org_id !== p.org?.id) return fail("Listing not found.");
  try {
    const { events } = await marketEvents(input.hash);
    if (!events.some((e) => e.name === "Cancelled" && Number(e.args.listingId) === Number(l.onchain_listing_id))) throw new Error("No Cancelled event for this listing");
    await db.from("marketplace_listings").update({ active: false, quantity_available: 0 }).eq("id", l.id);
    await audit(p.id, "listing.cancel", "marketplace_listing", l.id, { tx: input.hash });
    revalidatePath("/ngo", "layout");
    return { ok: true, data: null };
  } catch (e) { return fail((e as Error).message); }
}

// Company bought credits: confirm the Purchased event, record the purchase, re-read what is left.
export async function confirmPurchase(input: { hash: string; listingId: string }): Promise<Result<{ quantity: number }>> {
  const p = await requireRole("company");
  if (!txHash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  if (!p.org?.wallet_address) return fail("Link your company wallet first.");
  const db = adminClient();
  const { data: l } = await db.from("marketplace_listings").select("id, onchain_listing_id, batch_id").eq("id", input.listingId).single();
  if (!l) return fail("Listing not found.");
  try {
    const { events } = await marketEvents(input.hash);
    const ev = events.find((e) => e.name === "Purchased" && Number(e.args.listingId) === Number(l.onchain_listing_id));
    if (!ev) throw new Error("No Purchased event for this listing in that transaction");
    if (!same(ev.args.buyer, p.org.wallet_address)) throw new Error("Bought from a wallet that isn’t your company’s linked wallet");
    const { data: purchase, error } = await db.from("purchases").upsert({
      listing_id: l.id, buyer_org_id: p.org.id, quantity: tonnes(ev.args.quantity), total_price: formatEther(ev.args.paid),
      status: "confirmed", buyer_address: ev.args.buyer, tx_hash: input.hash,
    }, { onConflict: "tx_hash" }).select("id").single();
    if (error) throw new Error(error.message);
    const onchain = await readMarket()?.listings(l.onchain_listing_id);
    if (onchain) await db.from("marketplace_listings").update({ quantity_available: tonnes(onchain.remaining), active: onchain.remaining > 0n }).eq("id", l.id);
    await audit(p.id, "credits.purchase", "purchase", purchase.id, { tx: input.hash, quantity: tonnes(ev.args.quantity) });
    revalidatePath("/company");
    return { ok: true, data: { quantity: tonnes(ev.args.quantity) } };
  } catch (e) { return fail((e as Error).message); }
}

// Company retired credits: confirm CreditsRetired, record the retirement and update the batch total.
export async function confirmRetirement(input: { hash: string; batchId: string; beneficiary: string }): Promise<Result<{ retirementId: string }>> {
  const p = await requireRole("company");
  if (!txHash.safeParse(input.hash).success) return fail("Invalid transaction hash.");
  if (!p.org?.wallet_address) return fail("Link your company wallet first.");
  const beneficiary = z.string().trim().min(2).max(200).safeParse(input.beneficiary);
  if (!beneficiary.success) return fail("Name who the retirement is for.");
  const db = adminClient();
  const { data: batch } = await db.from("credit_batches").select("id, onchain_batch_id").eq("id", input.batchId).single();
  if (!batch) return fail("Batch not found.");
  try {
    const { events } = await registryEvents(input.hash);
    const ev = events.find((e) => e.name === "CreditsRetired" && e.args.batchId.toString() === batch.onchain_batch_id);
    if (!ev) throw new Error("No CreditsRetired event for this batch in that transaction");
    if (!same(ev.args.holder, p.org.wallet_address)) throw new Error("Retired from a wallet that isn’t your company’s linked wallet");
    const { data: r, error } = await db.from("credit_retirements").upsert({
      batch_id: batch.id, org_id: p.org.id, quantity: tonnes(ev.args.quantity), beneficiary: beneficiary.data, reason: ev.args.reason,
      holder_address: ev.args.holder, tx_hash: input.hash,
    }, { onConflict: "tx_hash" }).select("id").single();
    if (error) throw new Error(error.message);
    const { data: all } = await db.from("credit_retirements").select("quantity").eq("batch_id", batch.id);
    await db.from("credit_batches").update({ retired_qty: (all ?? []).reduce((s, x) => s + Number(x.quantity), 0) }).eq("id", batch.id);
    await audit(p.id, "credits.retire", "credit_retirement", r.id, { tx: input.hash, quantity: tonnes(ev.args.quantity) });
    revalidatePath("/company");
    return { ok: true, data: { retirementId: r.id } };
  } catch (e) { return fail((e as Error).message); }
}
