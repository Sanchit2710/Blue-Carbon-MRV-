import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const p = await requireRole("admin");
  const supabase = await createClient();
  const { data: queue } = await supabase
    .from("projects")
    .select("id, name, status, ecosystem, region, area_hectares, updated_at, organizations(name)")
    .in("status", ["submitted", "under_review"])
    .order("updated_at");
  return (
    <RoleShell title="Verifier dashboard" who={p.email}>
      <AdminNav />
      <h2 className="mb-3 text-lg font-semibold">Review queue ({queue?.length ?? 0})</h2>
      {!queue?.length ? <p className="text-sm text-slate-600">Nothing awaiting review.</p> : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {queue.map((q) => (
            <li key={q.id}>
              <Link href={`/admin/projects/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                <span><span className="font-medium">{q.name}</span>
                  <span className="text-sm text-slate-500 capitalize"> · {(q.organizations as unknown as { name: string } | null)?.name} · {q.ecosystem.replace("_", " ")} · {q.region} · {q.area_hectares} ha</span></span>
                <StatusBadge status={q.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-slate-500">Credit issuance, transfer and retirement history appear here once Phase 4–5 is integrated.</p>
    </RoleShell>
  );
}
