import { AdminNav } from "@/components/AdminNav";
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
    <RoleShell title="Audit log" who={p.email}>
      <AdminNav />
      <form className="mb-4 flex gap-2 text-sm">
        <input name="action" defaultValue={prefix} placeholder="Filter by action prefix, e.g. project." className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5" />
        <button className="rounded border border-slate-400 px-3 py-1.5 hover:bg-stone-200">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase text-slate-500"><tr><th className="p-2">Time (UTC)</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">Detail</th></tr></thead>
          <tbody>{(data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-slate-100 align-top">
              <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="p-2">{(r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "—"}</td>
              <td className="p-2 font-mono text-xs">{r.action}</td>
              <td className="p-2 font-mono text-xs">{r.entity} {r.entity_id?.slice(0, 8)}</td>
              <td className="p-2 text-xs text-slate-600 break-all">{r.detail ? JSON.stringify(r.detail) : ""}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Latest 200 entries. The log is append-only for clients: no insert/update/delete policies exist.</p>
    </RoleShell>
  );
}
