import Link from "next/link";
import { AlertCircle, CalendarClock, FilePen, Plus } from "lucide-react";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { LinkPending } from "@/components/LinkPending";
import { ProjectRow } from "@/components/ProjectRow";
import { WalletLinkCard } from "@/components/chain/WalletLinkCard";
import { hasChain } from "@/lib/chain/config";
import { Page } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

// Monitoring reports due within this window count as "needs attention".
const dueBy = () => new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

type Attention = { href: string; icon: React.ReactNode; title: string; detail: string };

export default async function NgoPage() {
  const p = await requireRole("ngo");

  if (!p.org) {
    return (
      <Page title="Set up your organisation" lead="Projects are registered under your organisation, so verifiers know who is responsible for each site.">
        <ActionForm action={createOrganization} submitLabel="Save organisation" pendingLabel="Saving…" className="max-w-lg space-y-5 rounded-xl border border-border bg-white p-6">
          <label className={labelClass}><span>Organisation name</span><input name="name" required className={fieldClass} /></label>
          <label className={labelClass}><span>Type</span>
            <select name="type" className={fieldClass}><option value="ngo">NGO</option><option value="panchayat">Panchayat or community body</option></select>
          </label>
          <label className={labelClass}><span>State or district</span><input name="region" required className={fieldClass} /></label>
          <label className={labelClass}><span>Contact email</span><input name="contact_email" type="email" required defaultValue={p.email} className={fieldClass} /></label>
          <label className={labelClass}><span>Contact phone <span className="font-normal text-muted-foreground">(optional)</span></span><input name="contact_phone" type="tel" className={fieldClass} /></label>
        </ActionForm>
      </Page>
    );
  }

  const supabase = await createClient();
  const [{ data: projects }, { data: due }] = await Promise.all([
    supabase.from("projects").select("id, name, status, ecosystem, region, area_hectares, onchain_owner").eq("organization_id", p.org.id).order("updated_at", { ascending: false }),
    supabase.from("maintenance_reports").select("id, due_date, status, project_id, projects(name)").in("status", ["scheduled", "missed"]).lte("due_date", dueBy()).order("due_date"),
  ]);
  const list = projects ?? [];
  const by = (...s: string[]) => list.filter((x) => s.includes(x.status));

  const attention: Attention[] = [
    ...by("requires_more_evidence").map((x) => ({ href: `/ngo/projects/${x.id}`, icon: <AlertCircle className="size-5 text-amber-700" />, title: x.name, detail: "The verifier asked for more evidence" })),
    ...(due ?? []).map((m) => ({ href: `/ngo/projects/${m.project_id}`, icon: <CalendarClock className={`size-5 ${m.status === "missed" ? "text-red-700" : "text-brackish"}`} />,
      title: (m.projects as unknown as { name: string } | null)?.name ?? "Project", detail: m.status === "missed" ? `Monitoring report missed (due ${m.due_date})` : `Monitoring report due ${m.due_date}` })),
    ...by("draft").map((x) => ({ href: `/ngo/projects/${x.id}`, icon: <FilePen className="size-5 text-muted-foreground" />, title: x.name, detail: "Draft: add photos, then submit for verification" })),
  ];

  const summary = [
    { label: "Drafts", value: by("draft").length },
    { label: "With the verifier", value: by("submitted", "under_review").length },
    { label: "Need more evidence", value: by("requires_more_evidence").length },
    { label: "Approved", value: by("approved").length },
  ];

  return (
    <Page title={p.org.name} lead={p.org.region ?? undefined}
      actions={<Button asChild><Link href="/ngo/projects/new"><Plus className="size-5" aria-hidden />Register a project</Link></Button>}>
      {hasChain && <div className="mb-10"><WalletLinkCard orgId={p.org.id} wallet={p.org.wallet_address} locked={list.some((x) => x.onchain_owner)} /></div>}
      {!list.length ? (
        <div className="rounded-xl border border-dashed border-border bg-white/60 p-8">
          <p className="text-lg font-medium text-mangrove">Register your first restoration site.</p>
          <p className="mt-1 max-w-[56ch] text-muted-foreground">You’ll need the site boundary, area, species and planting date. Photos come after, straight from your phone.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-white sm:grid-cols-4 sm:divide-x">
            {summary.map((s) => (
              <div key={s.label} className="px-5 py-4">
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="tabular mt-1 font-display text-3xl font-semibold text-mangrove">{s.value}</dd>
              </div>
            ))}
          </dl>

          {!!attention.length && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-mangrove">Needs your attention</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
                {attention.map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60 active:bg-muted">
                      <span aria-hidden>{a.icon}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.title}</span><span className="block text-sm text-muted-foreground">{a.detail}</span></span>
                      <LinkPending />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-mangrove">All projects</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
              {list.map((pr) => <ProjectRow key={pr.id} href={`/ngo/projects/${pr.id}`} name={pr.name} ecosystem={pr.ecosystem} region={pr.region} extra={`${pr.area_hectares} ha`} status={pr.status} />)}
            </ul>
          </section>
          <p className="text-sm text-muted-foreground">Credits, sales and payouts will show here once credit issuance is switched on.</p>
        </div>
      )}
    </Page>
  );
}
