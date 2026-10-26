import { notFound } from "next/navigation";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { EvidenceTable } from "@/components/EvidenceTable";
import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { submitMaintenance, submitProject, uploadEvidence } from "../../actions";

export default async function ProjectPage({ params }: PageProps<"/ngo/projects/[id]">) {
  const { id } = await params;
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: evidence }, { data: decisions }, { data: maintenance }] = await Promise.all([
    supabase.from("evidence_files").select("id, kind, sha256, mime_type, size_bytes, gps_lat, gps_lng, captured_at, flags, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("verification_decisions").select("id, decision, reason, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("maintenance_reports").select("id, due_date, status, notes, review_notes").eq("project_id", id).order("due_date"),
  ]);
  const editable = project.status === "draft" || project.status === "requires_more_evidence";

  return (
    <RoleShell title={project.name} who={p.email}>
      <div className="space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-3"><StatusBadge status={project.status} />
            <span className="text-sm text-slate-600 capitalize">{project.ecosystem.replace("_", " ")} · {project.region} · {project.area_hectares} ha</span></div>
          <p className="text-sm text-slate-700">{project.description}</p>
          <p className="mt-2 text-xs text-slate-500">Planted {project.planting_date} · Stewardship {project.stewardship_start} → {project.stewardship_end} · Responsible: {project.stewardship_responsible}</p>
        </section>

        {!!decisions?.length && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Verifier feedback</h2>
            <ul className="space-y-2">{decisions.map((d) => (
              <li key={d.id} className="rounded border border-slate-200 bg-white p-3 text-sm"><StatusBadge status={d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : "requires_more_evidence"} /> {d.reason}</li>
            ))}</ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Evidence</h2>
          <p className="mb-3 text-xs text-slate-500">Hashes prove file consistency only, not that a photo shows a genuine restoration site. GPS/EXIF can be missing or altered; flags are hints for the verifier, not verdicts. Storage is Supabase private storage — IPFS is not integrated.</p>
          <EvidenceTable rows={evidence ?? []} />
          <ActionForm action={uploadEvidence} submitLabel="Upload evidence" className="mt-4 max-w-lg space-y-3">
            <input type="hidden" name="project_id" value={id} />
            <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className={fieldClass} />
            <p className="text-xs text-slate-500">Photos (JPEG/PNG/WebP) or PDF documents, max 10 MB. Use original files with GPS enabled — screenshots and re-exports strip EXIF.</p>
          </ActionForm>
        </section>

        {editable && (
          <section>
            <ActionForm action={submitProject} submitLabel="Submit for verification" className="space-y-2">
              <input type="hidden" name="project_id" value={id} />
              <p className="text-sm text-slate-600">Submitting locks project details until the verifier responds. Submission does not issue any credits.</p>
            </ActionForm>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Maintenance reports</h2>
          {!maintenance?.length ? <p className="text-sm text-slate-600">The ten-year monitoring schedule is created when a verifier approves the project.</p> : (
            <ul className="space-y-3">{maintenance.map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3 text-sm"><span className="font-medium">Due {m.due_date}</span><StatusBadge status={m.status} /></div>
                {m.notes && <p className="mt-2 text-sm text-slate-700">{m.notes}</p>}
                {m.review_notes && <p className="mt-1 text-sm text-slate-500">Verifier: {m.review_notes}</p>}
                {(m.status === "scheduled" || m.status === "missed") && (
                  <ActionForm action={submitMaintenance} submitLabel="Submit report" className="mt-3 space-y-2">
                    <input type="hidden" name="report_id" value={m.id} /><input type="hidden" name="project_id" value={id} />
                    <textarea name="notes" rows={3} required minLength={10} placeholder="Survival rate, damage, interventions…" className={fieldClass} />
                  </ActionForm>
                )}
              </li>))}</ul>
          )}
        </section>
      </div>
    </RoleShell>
  );
}
