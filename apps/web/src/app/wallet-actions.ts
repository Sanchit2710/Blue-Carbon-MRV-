"use server";

import { verifyMessage } from "ethers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { requireAnyRole } from "@/lib/auth";
import { walletLinkMessage } from "@/lib/chain/link";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The organisation signs a message with MetaMask; the signature proves it controls the address.
export async function linkWallet(input: { address: string; signature: string; issuedAt: string }): Promise<FormState> {
  const p = await requireAnyRole("ngo", "company");
  if (!p.org) return { error: "Set up your organisation first." };
  const v = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), issuedAt: z.string().datetime() }).safeParse(input);
  if (!v.success) return { error: "Invalid wallet details." };
  const age = Date.now() - Date.parse(v.data.issuedAt);
  if (age < -60_000 || age > 10 * 60_000) return { error: "That signature has expired. Please try again." };
  let signer: string;
  try { signer = verifyMessage(walletLinkMessage(v.data.address, p.org.id, v.data.issuedAt), v.data.signature); }
  catch { return { error: "The signature couldn’t be verified." }; }
  if (signer.toLowerCase() !== v.data.address.toLowerCase()) return { error: "The signature doesn’t match that wallet." };
  // One wallet per organisation: otherwise a seller and a buyer could be the same account.
  // (Other organisations aren't visible to this user under RLS, so check with the service key.)
  const { data: taken } = await adminClient().from("organizations").select("name").ilike("wallet_address", signer).neq("id", p.org.id).limit(1);
  if (taken?.length) return { error: `That MetaMask account (${signer.slice(0, 6)}…${signer.slice(-4)}) is already linked to ${taken[0].name}. Pick a different account in MetaMask.` };
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ wallet_address: signer }).eq("id", p.org.id).select("id");
  if (error) return { error: error.message.replace(/^.*?exception: /i, "") };
  if (!data?.length) return { error: "Organisation not found." };
  await supabase.rpc("log_audit", { p_action: "organization.link_wallet", p_entity: "organization", p_entity_id: p.org.id, p_detail: { address: signer } });
  revalidatePath(`/${p.role}`);
  return { notice: p.role === "ngo" ? "Wallet linked. Credits for your approved projects will be issued to it." : "Wallet linked. Credits you buy will be held in it." };
}
