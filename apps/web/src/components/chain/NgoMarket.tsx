import { ExternalLink } from "lucide-react";
import { hasMarket, short, txUrl } from "@/lib/chain/config";
import { readRegistry } from "@/lib/chain/server";
import { tonnes } from "@/lib/chain/units";
import { createClient } from "@/lib/supabase/server";
import { CancelListing, SellCredits } from "./SellCredits";

// NGO view of a project's issued credits: wallet balance, listings and sales.
export async function NgoMarket({ projectId, wallet }: { projectId: string; wallet: string | null }) {
  if (!hasMarket || !wallet) return null;
  const supabase = await createClient();
  const { data: batches } = await supabase.from("credit_batches").select("id, onchain_batch_id, period_start, period_end, issued_qty").eq("project_id", projectId).gt("issued_qty", 0);
  if (!batches?.length) return null;
  const ids = batches.map((b) => b.id);
  const [{ data: listings }, { data: sales }] = await Promise.all([
    supabase.from("marketplace_listings").select("id, batch_id, onchain_listing_id, quantity_available, price_per_credit, active").in("batch_id", ids).eq("active", true),
    supabase.from("purchases").select("id, quantity, total_price, tx_hash, created_at, marketplace_listings!inner(batch_id)").in("marketplace_listings.batch_id", ids).eq("status", "confirmed").order("created_at", { ascending: false }),
  ]);
  const reg = readRegistry();
  const balances = await Promise.all(batches.map(async (b) => (reg ? tonnes(await reg.balanceOf(wallet, b.onchain_batch_id)) : 0)));

  return (
    <div className="space-y-6">
      {batches.map((b, i) => (
        <div key={b.id} className="space-y-4 rounded-xl border border-border bg-white p-5">
          <p className="text-muted-foreground"><span className="tabular font-display text-xl font-semibold text-foreground">{balances[i]}</span> tCO2e in your wallet from the {b.period_start} to {b.period_end} batch</p>
          {(listings ?? []).filter((l) => l.batch_id === b.id).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
              <span><span className="tabular font-medium">{Number(l.quantity_available)} tCO2e</span> <span className="text-muted-foreground">for sale at {Number(l.price_per_credit)} Sepolia ETH each</span></span>
              <CancelListing listingId={l.id} onchainListingId={Number(l.onchain_listing_id)} wallet={wallet} />
            </div>
          ))}
          {balances[i] > 0 && <SellCredits batchId={b.id} onchainBatchId={b.onchain_batch_id} max={balances[i]} wallet={wallet} />}
        </div>
      ))}
      {!!sales?.length && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-mangrove">Sales</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">{sales.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><span className="tabular font-medium">{Number(s.quantity)} tCO2e</span> <span className="text-muted-foreground">sold for {Number(s.total_price)} Sepolia ETH, paid to your wallet</span></span>
              {s.tx_hash && <a href={txUrl(s.tx_hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">{short(s.tx_hash)}<ExternalLink className="size-3.5" aria-hidden /></a>}
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
