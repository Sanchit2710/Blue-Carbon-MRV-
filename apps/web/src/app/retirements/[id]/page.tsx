import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { Logo } from "@/components/site/Logo";
import { CHAIN_NAME, REGISTRY_ADDRESS, addressUrl, short, txUrl } from "@/lib/chain/config";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

// Public, printable record of a retirement. Every field can be checked on Etherscan.
export default async function Certificate({ params }: PageProps<"/retirements/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("credit_retirements")
    .select("id, quantity, beneficiary, reason, holder_address, tx_hash, is_demo, created_at, organizations(name), credit_batches(onchain_batch_id, period_start, period_end, methodology, verification_ref, projects(id, name, region))")
    .eq("id", id).maybeSingle();
  if (!r) notFound();
  const b = r.credit_batches as unknown as { onchain_batch_id: string; period_start: string; period_end: string; methodology: string; verification_ref: string; projects: { id: string; name: string; region: string } };
  const org = r.organizations as unknown as { name: string } | null;
  const rows: [string, React.ReactNode][] = [
    ["Retired by", org?.name],
    ["On behalf of", r.beneficiary],
    ["Reason", r.reason],
    ["Project", <Link key="p" href={`/projects/${b.projects.id}`} className="font-medium text-mangrove underline underline-offset-4">{b.projects.name}, {b.projects.region}</Link>],
    ["Crediting period", `${b.period_start} to ${b.period_end}`],
    ["Methodology", b.methodology],
    ["Verification", b.verification_ref],
    ["Date", new Date(r.created_at).toISOString().slice(0, 10)],
    ["Wallet", r.holder_address ? <a key="w" href={addressUrl(r.holder_address)} className="font-medium text-mangrove underline underline-offset-4">{short(r.holder_address)}</a> : "—"],
    ["Transaction", r.is_demo ? "None (simulated)" : r.tx_hash ? <a key="t" href={txUrl(r.tx_hash)} className="inline-flex items-center gap-1 font-medium text-mangrove underline underline-offset-4">{short(r.tx_hash)}<ExternalLink className="size-3.5" aria-hidden /></a> : "—"],
    ["Registry", <a key="r" href={addressUrl(REGISTRY_ADDRESS)} className="font-medium text-mangrove underline underline-offset-4">{short(REGISTRY_ADDRESS)} on {CHAIN_NAME}</a>],
  ];
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4 print:hidden"><Logo /><PrintButton /></div>
      <article className="mt-10 rounded-2xl border border-border bg-white p-8 sm:p-12 print:border-0 print:p-0">
        {r.is_demo && <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Demonstration record. This retirement was simulated for a demo and is not recorded on any blockchain.</p>}
        <p className="text-muted-foreground">Retirement record</p>
        <h1 className="mt-2 text-4xl font-semibold text-mangrove sm:text-5xl"><span className="tabular">{Number(r.quantity)}</span> tCO2e retired</h1>
        <p className="mt-3 max-w-[60ch] text-muted-foreground">These credits were permanently removed from circulation on the BlueCarbon registry and can’t be sold or transferred again.</p>
        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-8 sm:grid-cols-[180px_1fr]">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}
        </dl>
        <p className="mt-10 text-sm text-muted-foreground">Recorded on the {CHAIN_NAME} test network. This is a demonstration record, not a legally recognised carbon credit retirement; recognition depends on the applicable crediting programme.</p>
      </article>
    </main>
  );
}
