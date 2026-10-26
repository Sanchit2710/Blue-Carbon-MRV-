import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { RetireCredits } from "@/components/chain/RetireCredits";
import { DemoBadge } from "@/components/DemoBadge";
import { demoHolding } from "@/lib/demo";
import { adminClient } from "@/lib/supabase/admin";
import { WalletLinkCard } from "@/components/chain/WalletLinkCard";
import { Page } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { hasMarket, short, txUrl } from "@/lib/chain/config";
import { readRegistry } from "@/lib/chain/server";
import { tonnes } from "@/lib/chain/units";
import { createClient } from "@/lib/supabase/server";
import { createCompanyOrg } from "./actions";

type Batch = { id: string; is_demo: boolean; onchain_batch_id: string | null; period_start: string; period_end: string; methodology: string; projects: { id: string; name: string; region: string } };
type Purchase = { id: string; quantity: number; total_price: number; tx_hash: string | null; is_demo: boolean; created_at: string; marketplace_listings: { credit_batches: Batch } | null };

export default async function CompanyPage() {
  const p = await requireRole("company");

  if (!p.org) {
    return (
      <Page title="Set up your company" lead="Purchases and retirements are recorded under your company, so your offset claims point back to it.">
        <ActionForm action={createCompanyOrg} submitLabel="Save company" pendingLabel="Saving…" className="max-w-lg space-y-5 rounded-xl border border-border bg-white p-6">
          <label className={labelClass}><span>Company name</span><input name="name" required className={fieldClass} /></label>
          <label className={labelClass}><span>Contact email</span><input name="contact_email" type="email" required defaultValue={p.email} className={fieldClass} /></label>
          <label className={labelClass}><span>Country or region <span className="font-normal text-muted-foreground">(optional)</span></span><input name="region" className={fieldClass} /></label>
        </ActionForm>
      </Page>
    );
  }

  const supabase = await createClient();
  const [{ data: purchases }, { data: retirements }] = await Promise.all([
    supabase.from("purchases").select("id, quantity, total_price, tx_hash, is_demo, created_at, marketplace_listings(credit_batches(id, is_demo, onchain_batch_id, period_start, period_end, methodology, projects(id, name, region)))")
      .eq("buyer_org_id", p.org.id).eq("status", "confirmed").order("created_at", { ascending: false }),
    supabase.from("credit_retirements").select("id, quantity, beneficiary, reason, is_demo, created_at, credit_batches(projects(name))").eq("org_id", p.org.id).order("created_at", { ascending: false }),
  ]);
  const bought = (purchases ?? []) as unknown as Purchase[];

  // Holdings: every batch bought, with the wallet's live on-chain balance as the source of truth.
  const batches = [...new Map(bought.flatMap((x) => (x.marketplace_listings ? [[x.marketplace_listings.credit_batches.id, x.marketplace_listings.credit_batches] as const] : []))).values()];
  const reg = readRegistry();
  const wallet = p.org.wallet_address;
  // Demo batches: simulated purchases minus simulated retirements. Real batches: live on-chain balance.
  const holdings = await Promise.all(batches.map(async (b) => ({
    batch: b,
    held: b.is_demo ? await demoHolding(adminClient(), p.org!.id, b.id) : wallet && reg && b.onchain_batch_id ? tonnes(await reg.balanceOf(wallet, b.onchain_batch_id)) : null,
  })));

  return (
    <Page title={p.org.name} lead="Credits you hold, what you bought, and what you retired."
      actions={hasMarket ? <Button asChild><Link href="/marketplace">Browse the marketplace</Link></Button> : undefined}>
      <div className="space-y-12">
        <WalletLinkCard orgId={p.org.id} wallet={wallet} locked={false} purpose="buy" />

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-mangrove">Credits you hold</h2>
          {!holdings.length ? <p className="text-muted-foreground">You don’t hold any credits yet. Approved projects with credits for sale are on the marketplace.</p> : (
            <ul className="space-y-3">{holdings.map(({ batch: b, held }) => (
              <li key={b.id} className="rounded-xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link href={`/projects/${b.projects.id}`} className="font-display text-xl font-semibold text-mangrove underline-offset-4 hover:underline">{b.projects.name}</Link>
                    <p className="text-sm text-muted-foreground">{b.projects.region}, crediting period {b.period_start} to {b.period_end}, {b.methodology}</p>
                  </div>
                  <p><span className="tabular font-display text-2xl font-semibold">{held ?? "—"}</span> <span className="text-muted-foreground">{b.is_demo ? "tCO2e held (simulated)" : "tCO2e in your wallet"}</span></p>
                </div>
                {b.is_demo && <p className="mt-2"><DemoBadge /></p>}
                {held && held > 0 && (b.is_demo || wallet) ? <div className="mt-3"><RetireCredits batchId={b.id} onchainBatchId={b.onchain_batch_id} max={held} wallet={wallet} companyName={p.org!.name} demo={b.is_demo} /></div> : null}
              </li>
            ))}</ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-mangrove">Retirements</h2>
          {!retirements?.length ? <p className="text-muted-foreground">No retirements yet. Retiring credits creates a public certificate you can share.</p> : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">{retirements.map((r) => (
              <li key={r.id}><Link href={`/retirements/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/60">
                <span><span className="tabular font-medium">{Number(r.quantity)} tCO2e</span> <span className="text-muted-foreground">from {(r.credit_batches as unknown as { projects: { name: string } } | null)?.projects.name}, for {r.beneficiary}</span></span>
                <span className="inline-flex items-center gap-2">{r.is_demo && <DemoBadge label="Simulated (demo)" />}<span className="text-sm font-medium text-mangrove">View certificate</span></span>
              </Link></li>
            ))}</ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-mangrove">Purchases</h2>
          {!bought.length ? <p className="text-muted-foreground">No purchases yet.</p> : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">{bought.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span><span className="tabular font-medium">{Number(x.quantity)} tCO2e</span> <span className="text-muted-foreground">from {x.marketplace_listings?.credit_batches.projects.name} for {Number(x.total_price)} Sepolia ETH</span></span>
                {x.is_demo && <DemoBadge label="Simulated (demo)" />}
                {x.tx_hash && <a href={txUrl(x.tx_hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-mangrove underline-offset-4 hover:underline">{short(x.tx_hash)}<ExternalLink className="size-3.5" aria-hidden /></a>}
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </Page>
  );
}
