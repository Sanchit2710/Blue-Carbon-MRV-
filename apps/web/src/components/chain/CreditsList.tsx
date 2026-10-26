import { ExternalLink } from "lucide-react";
import { short, txUrl } from "@/lib/chain/config";
import { createClient } from "@/lib/supabase/server";

// Issued batches for a project, with the transactions that created them. Server component.
export async function CreditsList({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const [{ data: batches }, { data: txs }] = await Promise.all([
    supabase.from("credit_batches").select("id, methodology, verification_ref, period_start, period_end, approved_qty, issued_qty, retired_qty").eq("project_id", projectId).order("period_start"),
    supabase.from("blockchain_transactions").select("tx_hash, kind, status, batch_id, created_at").eq("project_id", projectId).order("created_at"),
  ]);
  const registration = (txs ?? []).find((t) => t.kind === "register" && t.status === "confirmed");
  const issued = (batches ?? []).filter((b) => Number(b.issued_qty) > 0);
  if (!issued.length && !registration) return <p className="text-muted-foreground">No credits have been issued for this project yet.</p>;
  return (
    <div className="space-y-3">
      {issued.map((b) => {
        const tx = (txs ?? []).find((t) => t.batch_id === b.id && t.kind === "issue" && t.status === "confirmed");
        return (
          <div key={b.id} className="rounded-xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p><span className="tabular font-display text-2xl font-semibold text-mangrove">{Number(b.issued_qty).toLocaleString()}</span> <span className="text-muted-foreground">tCO2e issued</span></p>
              <p className="tabular text-sm text-muted-foreground">{b.period_start} to {b.period_end}</p>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Retired</dt><dd className="tabular">{Number(b.retired_qty).toLocaleString()} tCO2e</dd>
              <dt className="text-muted-foreground">Methodology</dt><dd>{b.methodology}</dd>
              <dt className="text-muted-foreground">Verification</dt><dd>{b.verification_ref}</dd>
              {tx?.tx_hash && <><dt className="text-muted-foreground">Transaction</dt><dd><a href={txUrl(tx.tx_hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">{short(tx.tx_hash)}<ExternalLink className="size-3.5" aria-hidden /></a></dd></>}
            </dl>
          </div>
        );
      })}
      {registration?.tx_hash && <p className="text-sm text-muted-foreground">Registered on-chain in <a href={txUrl(registration.tx_hash)} target="_blank" rel="noreferrer" className="font-medium text-mangrove underline underline-offset-4">{short(registration.tx_hash)}</a>.</p>}
    </div>
  );
}
