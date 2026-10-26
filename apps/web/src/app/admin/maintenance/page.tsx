import Link from "next/link";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { Page } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markMissed, reviewMaintenance } from "../actions";

type Row = { id: string; due_date: string; status: string; notes: string | null; review_notes: string | null; projects: { id: string; name: string } | null };

export default async function MaintenanceAdminPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("maintenance_reports").select("id, due_date, status, notes, review_notes, projects(id, name)")
    .in("status", ["submitted", "missed", "flagged"]).order("due_date");
  const rows = (data ?? []) as unknown as Row[];
  const section = (title: string, status: string) => {
    const list = rows.filter((r) => r.status === status);
    return (
      <section>
        <h2 className="mb-4 text-2xl font-semibold text-mangrove">{title} ({list.length})</h2>
        {!list.length ? <p className="text-muted-foreground">None right now.</p> : (
          <ul className="space-y-3">{list.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center gap-3"><Link href={`/admin/projects/${r.projects?.id}`} className="font-medium text-mangrove underline underline-offset-4">{r.projects?.name}</Link><span className="tabular text-sm text-muted-foreground">due {r.due_date}</span><StatusBadge status={r.status} /></div>
              {r.notes && <p className="mt-2 text-foreground">NGO: {r.notes}</p>}
              {r.review_notes && <p className="mt-1 text-muted-foreground">Verifier: {r.review_notes}</p>}
              {status === "submitted" && (
                <ActionForm action={reviewMaintenance} submitLabel="Record review" className="mt-4 space-y-3">
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
    <Page title="Monitoring reports">

      <div className="space-y-12">
        <ActionForm action={markMissed} submitLabel="Mark overdue reports as missed" variant="outline" className="space-y-3 rounded-xl border border-border bg-white p-5">
          <p className="max-w-[62ch] text-muted-foreground">Flags unsubmitted milestones past their due date. This is a follow-up flag only; no penalty or forfeiture is applied.</p>
        </ActionForm>
        {section("Awaiting review", "submitted")}
        {section("Flagged", "flagged")}
        {section("Missed deadlines", "missed")}
      </div>
    </Page>
  );
}
