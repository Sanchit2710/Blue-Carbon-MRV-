import { ProjectRow } from "@/components/ProjectRow";
import { Page } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: queue }, { count: approved }, { count: toReview }, { count: missed }, { data: approvedList }] = await Promise.all([
    supabase.from("projects").select("id, name, status, ecosystem, region, area_hectares, updated_at, organizations(name)").in("status", ["submitted", "under_review"]).order("updated_at"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("maintenance_reports").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("maintenance_reports").select("id", { count: "exact", head: true }).in("status", ["missed", "flagged"]),
    supabase.from("projects").select("id, name, status, ecosystem, region, organizations(name)").eq("status", "approved").order("updated_at", { ascending: false }),
  ]);
  const strip = [
    { label: "Projects waiting", value: queue?.length ?? 0, href: "#queue" },
    { label: "Reports to review", value: toReview ?? 0, href: "/admin/maintenance" },
    { label: "Missed or flagged reports", value: missed ?? 0, href: "/admin/maintenance" },
    { label: "Approved projects", value: approved ?? 0, href: "#approved" },
  ];
  return (
    <Page title="Verifier dashboard" lead={queue?.length ? `${queue.length} project${queue.length === 1 ? "" : "s"} waiting, oldest first.` : "Nothing is waiting for review."}>
      <dl className="mb-10 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-white sm:grid-cols-4 sm:divide-x sm:divide-border">
        {strip.map((x) => (
          <a key={x.label} href={x.href} className="block px-5 py-4 transition-colors hover:bg-muted/60">
            <dt className="text-sm text-muted-foreground">{x.label}</dt>
            <dd className="tabular mt-1 font-display text-3xl font-semibold text-mangrove">{x.value}</dd>
          </a>
        ))}
      </dl>
      <h2 id="queue" className="mb-4 text-2xl font-semibold text-mangrove">Review queue</h2>
      {!!queue?.length && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {queue.map((q) => <ProjectRow key={q.id} href={`/admin/projects/${q.id}`} name={q.name} ecosystem={q.ecosystem} region={q.region}
            extra={`${(q.organizations as unknown as { name: string } | null)?.name ?? "unknown organisation"}`} status={q.status} />)}
        </ul>
      )}
      <h2 id="approved" className="mb-2 mt-12 text-2xl font-semibold text-mangrove">Approved projects</h2>
      <p className="mb-4 text-muted-foreground">Open one to issue credits or check its monitoring.</p>
      {!approvedList?.length ? <p className="text-muted-foreground">None yet.</p> : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {approvedList.map((q) => <ProjectRow key={q.id} href={`/admin/projects/${q.id}`} name={q.name} ecosystem={q.ecosystem} region={q.region}
            extra={(q.organizations as unknown as { name: string } | null)?.name ?? undefined} status={q.status} />)}
        </ul>
      )}
    </Page>
  );
}
