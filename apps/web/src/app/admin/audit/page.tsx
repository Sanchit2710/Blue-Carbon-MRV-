import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const p = await requireRole("admin");
  const sp = await searchParams;
  const prefix = typeof sp.action === "string" ? sp.action.replace(/[^\w.]/g, "") : "";
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, entity, entity_id, detail, created_at, profiles(full_name)").order("id", { ascending: false }).limit(200);
  if (prefix) q = q.like("action", `${prefix}%`);
  const { data } = await q;
  return (
    <RoleShell title="Audit log" who={p.email} role={p.role}>

      <form className="mb-6 flex flex-wrap gap-2" role="search">
        <input name="action" defaultValue={prefix} aria-label="Filter by action" placeholder="Filter by action, e.g. project." className="h-11 w-72 rounded-lg border border-input bg-white px-3.5" />
        <button className="h-11 rounded-lg border border-border bg-white px-5 font-medium hover:bg-muted">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-left text-sm text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Time (UTC)</th><th className="px-4 py-3 font-medium">Actor</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Entity</th><th className="px-4 py-3 font-medium">Detail</th></tr></thead>
          <tbody>{(data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="px-4 py-3 font-medium">{(r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.entity} {r.entity_id?.slice(0, 8)}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground break-all">{r.detail ? JSON.stringify(r.detail) : ""}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Latest 200 entries. The log is append-only for clients: no insert/update/delete policies exist.</p>
    </RoleShell>
  );
}
