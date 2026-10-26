import { ProjectRow } from "@/components/ProjectRow";
import { Page } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: queue } = await supabase
    .from("projects")
    .select("id, name, status, ecosystem, region, area_hectares, updated_at, organizations(name)")
    .in("status", ["submitted", "under_review"])
    .order("updated_at");
  return (
    <Page title="Review queue" lead={queue?.length ? `${queue.length} project${queue.length === 1 ? "" : "s"} waiting, oldest first.` : "Nothing is waiting for review."}>
      {!!queue?.length && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {queue.map((q) => <ProjectRow key={q.id} href={`/admin/projects/${q.id}`} name={q.name} ecosystem={q.ecosystem} region={q.region}
            extra={`${(q.organizations as unknown as { name: string } | null)?.name ?? "unknown organisation"}`} status={q.status} />)}
        </ul>
      )}
      <p className="mt-8 text-sm text-muted-foreground">Credit issuance, transfer and retirement history will appear here once the ledger is connected.</p>
    </Page>
  );
}
