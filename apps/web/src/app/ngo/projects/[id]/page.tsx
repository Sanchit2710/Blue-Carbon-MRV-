import { notFound } from "next/navigation";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { EvidenceCapture } from "@/components/EvidenceCapture";
import { BoundaryMap } from "@/components/BoundaryMap";
import { EvidenceTable } from "@/components/EvidenceTable";
import { parseBoundary } from "@/lib/evidence/geo";
import { CreditsList } from "@/components/chain/CreditsList";
import { NgoMarket } from "@/components/chain/NgoMarket";
import { Page } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { signEvidence } from "@/lib/evidence/sign";
import { createClient } from "@/lib/supabase/server";
import { submitMaintenance, submitProject } from "../../actions";

const ecosystemName: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Other coastal wetland" };
const reportWindow = () => new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
const decisionStatus = (d: string) => (d === "approve" ? "approved" : d === "reject" ? "rejected" : "requires_more_evidence");

export default async function ProjectPage({ params }: PageProps<"/ngo/projects/[id]">) {
  const { id } = await params;
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: evidence }, { data: decisions }, { data: maintenance }, { data: boundaryRow }] = await Promise.all([
    supabase.from("evidence_files").select("id, kind, sha256, mime_type, size_bytes, storage_path, width, height, gps_lat, gps_lng, device_lat, device_lng, device_accuracy_m, captured_at, flags, is_demo, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("verification_decisions").select("id, decision, reason, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("maintenance_reports").select("id, due_date, status, notes, review_notes").eq("project_id", id).order("due_date"),
    supabase.from("project_boundaries").select("geojson").eq("project_id", id).maybeSingle(),
  ]);
  const boundary = boundaryRow ? parseBoundary(JSON.stringify(boundaryRow.geojson)) : null;
  const rows = await signEvidence(supabase, evidence ?? []);
  const editable = project.status === "draft" || project.status === "requires_more_evidence";
  const openUntil = reportWindow(); // reports open for submission 90 days before they're due

  return (
    <Page title={project.name}>
      <div className="space-y-12">
        <section className="flex flex-wrap items-start justify-between gap-6 rounded-xl border border-border bg-white p-6">
          <div className="max-w-[60ch] space-y-3">
            <StatusBadge status={project.status} />
            {project.description && <p className="text-[17px] leading-relaxed">{project.description}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Ecosystem</dt><dd>{ecosystemName[project.ecosystem]}</dd>
            <dt className="text-muted-foreground">Location</dt><dd>{project.region}</dd>
            <dt className="text-muted-foreground">Area</dt><dd className="tabular">{project.area_hectares} ha</dd>
            <dt className="text-muted-foreground">Planted</dt><dd className="tabular">{project.planting_date}</dd>
            <dt className="text-muted-foreground">Stewardship</dt><dd className="tabular">{project.stewardship_start} to {project.stewardship_end}</dd>
            <dt className="text-muted-foreground">Responsible</dt><dd>{!project.stewardship_responsible || project.stewardship_responsible === "registering organization" ? p.org?.name : project.stewardship_responsible}</dd>
          </dl>
        </section>

        {!!decisions?.length && (
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-mangrove">Verifier feedback</h2>
            <ul className="space-y-3">{decisions.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-white p-5">
                <div className="flex items-center gap-3"><StatusBadge status={decisionStatus(d.decision)} /><span className="tabular text-sm text-muted-foreground">{new Date(d.created_at).toISOString().slice(0, 10)}</span></div>
                <p className="mt-2">{d.reason}</p>
              </li>
            ))}</ul>
          </section>
        )}

        {boundary?.ok && (
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-mangrove">Site boundary</h2>
            <BoundaryMap polygon={boundary.polygon} declaredHa={Number(project.area_hectares)}
              points={(evidence ?? []).flatMap((e) => {
                const lat = e.gps_lat ?? e.device_lat, lng = e.gps_lng ?? e.device_lng;
                return lat != null && lng != null ? [{ lat, lng, flagged: (e.flags as string[]).includes("outside_boundary") }] : [];
              })} />
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-mangrove">Evidence</h2>
          <EvidenceCapture projectId={id} />
          <EvidenceTable rows={rows} />
          <p className="max-w-[70ch] text-sm text-muted-foreground">A fingerprint (SHA-256) proves a file hasn’t changed since upload, not that it shows this site. Photo and phone locations can be missing or altered, so flags are hints for the verifier. Files are stored privately in Supabase; IPFS isn’t connected yet.</p>
        </section>

        {editable && (
          <section className="rounded-xl border border-border bg-white p-6">
            <h2 className="text-xl font-semibold text-mangrove">Ready for review?</h2>
            <ActionForm action={submitProject} submitLabel="Submit for verification" pendingLabel="Submitting…" className="mt-2 space-y-4">
              <input type="hidden" name="project_id" value={id} />
              <p className="max-w-[60ch] text-muted-foreground">Submitting locks the project details until the verifier responds. It doesn’t issue any credits.</p>
            </ActionForm>
          </section>
        )}

        {project.status === "approved" && (
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-mangrove">Credits</h2>
            <div className="space-y-6">
              <CreditsList projectId={id} />
              <NgoMarket projectId={id} wallet={p.org?.wallet_address ?? null} />
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-mangrove">Monitoring reports</h2>
          {!maintenance?.length ? <p className="text-muted-foreground">Your ten-year monitoring schedule appears here once a verifier approves the project.</p> : (
            <ol className="space-y-3">{maintenance.map((m, i) => (
              <li key={m.id} className="rounded-xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-center gap-3"><span className="font-medium">Year {i + 1}</span><span className="tabular text-sm text-muted-foreground">due {m.due_date}</span><StatusBadge status={m.status} /></div>
                {m.notes && <p className="mt-2">{m.notes}</p>}
                {m.review_notes && <p className="mt-1 text-muted-foreground">Verifier: {m.review_notes}</p>}
                {m.status === "scheduled" && m.due_date > openUntil && <p className="mt-1 text-sm text-muted-foreground">Opens for your report 90 days before it’s due.</p>}
                {(m.status === "missed" || (m.status === "scheduled" && m.due_date <= openUntil)) && (
                  <ActionForm action={submitMaintenance} submitLabel="Submit report" pendingLabel="Submitting…" className="mt-4 space-y-3">
                    <input type="hidden" name="report_id" value={m.id} /><input type="hidden" name="project_id" value={id} />
                    <label className="block space-y-2 text-sm font-medium">Site condition
                      <textarea name="notes" rows={3} required minLength={10} placeholder="Survival rate, storm or grazing damage, replanting done…" className={fieldClass} />
                    </label>
                  </ActionForm>
                )}
              </li>))}</ol>
          )}
        </section>
      </div>
    </Page>
  );
}
