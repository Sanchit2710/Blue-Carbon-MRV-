import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { BoundaryMap } from "@/components/BoundaryMap";
import { EvidenceTable, type EvidenceRow } from "@/components/EvidenceTable";
import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { parseBoundary } from "@/lib/evidence/geo";
import { createClient } from "@/lib/supabase/server";
import { reviewProject, startReview } from "../../actions";

export default async function ReviewPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  const p = await requireRole("admin");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*, organizations(name, contact_email, region)").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: evidence }, { data: boundaryRow }, { data: decisions }] = await Promise.all([
    supabase.from("evidence_files").select("id, kind, sha256, mime_type, storage_path, gps_lat, gps_lng, captured_at, flags, created_at").eq("project_id", id).order("created_at"),
    supabase.from("project_boundaries").select("geojson").eq("project_id", id).maybeSingle(),
    supabase.from("verification_decisions").select("id, decision, reason, created_at, profiles(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  const signed = evidence?.length ? await supabase.storage.from("evidence").createSignedUrls(evidence.map((e) => e.storage_path), 300) : null;
  const urlByPath = new Map((signed?.data ?? []).map((u) => [u.path, u.signedUrl] as const));
  const rows: EvidenceRow[] = (evidence ?? []).map((e) => ({ ...e, url: urlByPath.get(e.storage_path) ?? undefined }));
  const photos = rows.filter((r) => r.kind === "photo");
  const count = (f: string) => photos.filter((r) => (r.flags as string[]).includes(f)).length;
  const boundary = boundaryRow ? parseBoundary(JSON.stringify(boundaryRow.geojson)) : null;
  const points = photos.filter((r) => r.gps_lat != null).map((r) => ({ lat: r.gps_lat!, lng: r.gps_lng!, flagged: (r.flags as string[]).includes("outside_boundary") }));
  const org = project.organizations as unknown as { name: string; contact_email: string | null } | null;
  const reviewable = project.status === "submitted" || project.status === "under_review";

  return (
    <RoleShell title={project.name} who={p.email}>
      <AdminNav />
      <div className="space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-3"><StatusBadge status={project.status} />
            <span className="text-sm text-slate-600 capitalize">{project.ecosystem.replace("_", " ")} · {project.region} · {project.area_hectares} ha</span></div>
          <p className="text-sm text-slate-700">{project.description}</p>
          <p className="mt-2 text-xs text-slate-500">{org?.name} ({org?.contact_email}) · planted {project.planting_date} · stewardship {project.stewardship_start} → {project.stewardship_end}, responsible: {project.stewardship_responsible}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Automated checks</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            {[["Photos", photos.length], ["Missing GPS", count("missing_gps")], ["Outside boundary", count("outside_boundary")], ["Missing capture time", count("missing_capture_time")],
              ["Implausible / pre-planting time", count("capture_time_implausible") + count("captured_before_planting")], ["Exact duplicates", count("exact_duplicate")], ["Similar to other images", count("similar_image")]].map(([k, v]) => (
              <li key={k as string} className={`rounded border p-3 ${v && k !== "Photos" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}><span className="block text-xs text-slate-500">{k}</span><span className="text-lg font-semibold">{v}</span></li>))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Hints only. EXIF/GPS can be absent or forged, a hash shows file consistency not site authenticity, and similarity is a heuristic. Satellite/NDVI analysis is not available yet. Approval does not issue credits or fix a credit quantity.</p>
        </section>

        {boundary?.ok && <section><h2 className="mb-2 text-lg font-semibold">Boundary</h2><BoundaryMap polygon={boundary.polygon} points={points} /></section>}

        <section><h2 className="mb-2 text-lg font-semibold">Evidence</h2><EvidenceTable rows={rows} /><p className="mt-1 text-xs text-slate-500">File links are signed and expire after 5 minutes.</p></section>

        {!!decisions?.length && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Decision history</h2>
            <ul className="space-y-2">{decisions.map((d) => (
              <li key={d.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                <StatusBadge status={d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : "requires_more_evidence"} /> {d.reason}
                <span className="block text-xs text-slate-500">{(d.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "reviewer"} · {new Date(d.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              </li>))}</ul>
          </section>
        )}

        {reviewable && (
          <section className="space-y-6">
            {project.status === "submitted" && (
              <ActionForm action={startReview} submitLabel="Start review" className="space-y-2">
                <input type="hidden" name="project_id" value={id} />
                <p className="text-sm text-slate-600">Moves the project to <em>under review</em> (locks it for the NGO).</p>
              </ActionForm>
            )}
            <ActionForm action={reviewProject} submitLabel="Record decision" className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold">Decision</h2>
              <input type="hidden" name="project_id" value={id} />
              <label className="block text-sm font-medium">Outcome
                <select name="decision" className={`${fieldClass} mt-1`} defaultValue="request_more_evidence">
                  <option value="request_more_evidence">Request more evidence</option><option value="approve">Approve (opens 10-year monitoring schedule)</option><option value="reject">Reject (final)</option>
                </select>
              </label>
              <label className="block text-sm font-medium">Reason (shown to the NGO)<textarea name="reason" rows={3} required minLength={10} className={`${fieldClass} mt-1`} /></label>
              <p className="text-xs text-slate-500">Your identity, decision, reason and time are recorded in the audit log. You cannot review a project of an organization you belong to.</p>
            </ActionForm>
          </section>
        )}
      </div>
    </RoleShell>
  );
}
