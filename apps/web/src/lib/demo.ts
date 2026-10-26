import "server-only";
import type { adminClient } from "@/lib/supabase/admin";

// Demo holdings for a batch = simulated purchases minus simulated retirements (demo batches only).
export async function demoHolding(db: ReturnType<typeof adminClient>, orgId: string, batchId: string) {
  const [{ data: bought }, { data: retired }] = await Promise.all([
    db.from("purchases").select("quantity, marketplace_listings!inner(batch_id)").eq("buyer_org_id", orgId).eq("is_demo", true).eq("marketplace_listings.batch_id", batchId),
    db.from("credit_retirements").select("quantity").eq("org_id", orgId).eq("batch_id", batchId),
  ]);
  const sum = (rows: { quantity: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.quantity), 0);
  return Math.round((sum(bought) - sum(retired)) * 100) / 100;
}
