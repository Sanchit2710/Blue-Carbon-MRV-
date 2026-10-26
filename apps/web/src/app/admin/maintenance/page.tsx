import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markMissed, reviewMaintenance } from "../actions";

type Row = { id: string; due_date: string; status: string; notes: string | null; review_notes: string | null; projects: { id: string; name: string } | null };

export default async function MaintenanceAdminPage() {
  const p = await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("maintenance_reports").select("id, due_date, status, notes, review_notes, projects(id, name)")
    .in("status", ["submitted", "missed", "flagged"]).order("due_date");
  const rows = (data ?? []) as unknown as Row[];
  const section = (title: string, status: string) => {
    const list = rows.filter((r) => r.status === status);
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">{title} ({list.length})</h2>
        {!list.length ? <p className="text-sm text-slate-600">None.</p> : (
          <ul className="space-y-3">{list.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-center gap-3"><Link href={`/admin/projects/${r.projects?.id}`} className="font-medium text-teal-800 underline">{r.projects?.name}</Link><span>due {r.due_date}</span><StatusBadge status={r.status} /></div>
              {r.notes && <p className="mt-2 text-slate-700">NGO: {r.notes}</p>}
              {r.review_notes && <p className="mt-1 text-slate-500">Verifier: {r.review_notes}</p>}
              {status === "submitted" && (
                <ActionForm action={reviewMaintenance} submitLabel="Record review" className="mt-3 space-y-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <select name="outcome" className={fieldClass} defaultValue="verified"><option value="verified">Verified</option><option value="flagged">Flag for follow-up</option></select>
                  <textarea name="notes" rows={2} required minLength={5} placeholder="Review notes" className={fieldClass} />
                </ActionForm>
              )}
            </li>))}</ul>
        )}
      </section>
    );
  };
  return (
    <RoleShell title="Maintenance monitoring" who={p.email}>
      <AdminNav />
      <div className="space-y-8">
        <ActionForm action={markMissed} submitLabel="Mark overdue milestones as missed" className="space-y-2">
          <p className="text-sm text-slate-600">Flags unsubmitted milestones past their due date. This is a follow-up flag only; no penalty or forfeiture is applied.</p>
        </ActionForm>
        {section("Awaiting review", "submitted")}
        {section("Flagged", "flagged")}
        {section("Missed deadlines", "missed")}
      </div>
    </RoleShell>
  );
}
