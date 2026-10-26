import { notFound } from "next/navigation";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { BoundaryMap } from "@/components/BoundaryMap";
import { EvidenceTable, type EvidenceRow } from "@/components/EvidenceTable";
import { CreditsList } from "@/components/chain/CreditsList";
import { IssueCredits } from "@/components/chain/IssueCredits";
import { addressUrl, hasChain, short } from "@/lib/chain/config";
import { Page } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { parseBoundary } from "@/lib/evidence/geo";
import { signEvidence } from "@/lib/evidence/sign";
import { createClient } from "@/lib/supabase/server";
import { reviewProject, startReview } from "../../actions";

const today = () => new Date().toISOString().slice(0, 10);

export default async function ReviewPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  await requireRole("admin");
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*, organizations(name, contact_email, region, wallet_address)").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: evidence }, { data: boundaryRow }, { data: decisions }] = await Promise.all([
    supabase.from("evidence_files").select("id, kind, sha256, mime_type, size_bytes, storage_path, width, height, gps_lat, gps_lng, device_lat, device_lng, device_accuracy_m, captured_at, flags, created_at").eq("project_id", id).order("created_at"),
    supabase.from("project_boundaries").select("geojson").eq("project_id", id).maybeSingle(),
    supabase.from("verification_decisions").select("id, decision, reason, created_at, profiles(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  const rows: EvidenceRow[] = await signEvidence(supabase, evidence ?? []);
  const photos = rows.filter((r) => r.kind === "photo");
  const count = (f: string) => photos.filter((r) => (r.flags as string[]).includes(f)).length;
  const boundary = boundaryRow ? parseBoundary(JSON.stringify(boundaryRow.geojson)) : null;
  const points = photos.map((r) => (r.gps_lat != null ? { lat: r.gps_lat, lng: r.gps_lng! } : r.device_lat != null ? { lat: r.device_lat, lng: r.device_lng! } : null))
    .flatMap((pt, i) => (pt ? [{ ...pt, flagged: (photos[i].flags as string[]).includes("outside_boundary") }] : []));
  const org = project.organizations as unknown as { name: string; contact_email: string | null; wallet_address: string | null } | null;
  const approval = decisions?.find((d) => d.decision === "approve");
  const creditStart: string = project.planting_date ?? project.stewardship_start ?? today();
  const creditEnd = new Date(Date.parse(creditStart) + 365 * 864e5).toISOString().slice(0, 10);
  const reviewable = project.status === "submitted" || project.status === "under_review";

  return (
    <Page title={project.name}>

      <div className="space-y-8">
        <section className="rounded-xl border border-border bg-white p-6">
          <div className="mb-2 flex items-center gap-3"><StatusBadge status={project.status} />
            <span className="text-muted-foreground"><span className="capitalize">{project.ecosystem.replace("_", " ")}</span> in {project.region}, <span className="tabular">{project.area_hectares}</span> ha</span></div>
          <p className="text-sm text-foreground">{project.description}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm"><dt className="text-muted-foreground">Organisation</dt><dd>{org?.name} ({org?.contact_email})</dd><dt className="text-muted-foreground">Planted</dt><dd className="tabular">{project.planting_date}</dd><dt className="text-muted-foreground">Stewardship</dt><dd className="tabular">{project.stewardship_start} to {project.stewardship_end}, {project.stewardship_responsible}</dd></dl>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Automated checks</h2>
          <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[["Photos", photos.length], ["No location in photo", count("missing_gps")], ["Outside boundary", count("outside_boundary")], ["Photo and phone disagree", count("device_gps_mismatch")],
              ["No or odd capture time", count("missing_capture_time") + count("capture_time_implausible") + count("captured_before_planting")], ["Exact duplicates", count("exact_duplicate")], ["Look like other photos", count("similar_image")], ["Low resolution", count("low_resolution")]].map(([k, v]) => (
              <li key={k as string} className={`rounded-xl border p-4 ${v && k !== "Photos" ? "border-amber-300 bg-amber-50" : "border-border bg-white"}`}><span className="block text-muted-foreground">{k}</span><span className="tabular font-display text-2xl font-semibold">{v}</span></li>))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Hints only. EXIF/GPS can be absent or forged, a hash shows file consistency not site authenticity, and similarity is a heuristic. Satellite/NDVI analysis is not available yet. Approval does not issue credits or fix a credit quantity.</p>
        </section>

        {boundary?.ok && <section><h2 className="mb-2 text-lg font-semibold">Boundary</h2><BoundaryMap polygon={boundary.polygon} points={points} /></section>}

        <section><h2 className="mb-2 text-lg font-semibold">Evidence</h2><EvidenceTable rows={rows} /><p className="mt-2 text-sm text-muted-foreground">Links expire after 10 minutes. “Download original” gives the exact uploaded file, so its SHA-256 matches the one shown.</p></section>

        {!!decisions?.length && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Decision history</h2>
            <ul className="space-y-2">{decisions.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <StatusBadge status={d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : "requires_more_evidence"} /> {d.reason}
                <span className="block text-xs text-muted-foreground">{(d.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Reviewer"}, {new Date(d.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              </li>))}</ul>
          </section>
        )}

        {project.status === "approved" && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-mangrove">Credits</h2>
            <p className="text-muted-foreground">
              Organisation wallet: {org?.wallet_address
                ? <a href={addressUrl(org.wallet_address)} target="_blank" rel="noreferrer" className="tabular font-medium text-mangrove underline underline-offset-4">{short(org.wallet_address)}</a>
                : "not linked yet. The NGO connects MetaMask on its dashboard before credits can be issued."}
            </p>
            <CreditsList projectId={id} />
            {hasChain && org?.wallet_address && (
              <IssueCredits projectId={id} defaultStart={creditStart} defaultEnd={creditEnd}
                defaultRef={approval ? `BlueCarbon approval ${approval.id.slice(0, 8)} (${new Date(approval.created_at).toISOString().slice(0, 10)})` : `BlueCarbon project ${id.slice(0, 8)}`} />
            )}
          </section>
        )}

        {reviewable && (
          <section className="space-y-6">
            {project.status === "submitted" && (
              <ActionForm action={startReview} submitLabel="Start review" className="space-y-2">
                <input type="hidden" name="project_id" value={id} />
                <p className="text-sm text-muted-foreground">Moves the project to <em>under review</em> (locks it for the NGO).</p>
              </ActionForm>
            )}
            <ActionForm action={reviewProject} submitLabel="Record decision" className="max-w-xl space-y-3 rounded-xl border border-border bg-white p-6">
              <h2 className="text-lg font-semibold">Decision</h2>
              <input type="hidden" name="project_id" value={id} />
              <label className="block text-sm font-medium">Outcome
                <select name="decision" className={`${fieldClass} mt-1`} defaultValue="request_more_evidence">
                  <option value="request_more_evidence">Request more evidence</option><option value="approve">Approve (opens 10-year monitoring schedule)</option><option value="reject">Reject (final)</option>
                </select>
              </label>
              <label className="block text-sm font-medium">Reason (shown to the NGO)<textarea name="reason" rows={3} required minLength={10} className={`${fieldClass} mt-1`} /></label>
              <p className="text-xs text-muted-foreground">Your identity, decision, reason and time are recorded in the audit log. You cannot review a project of an organization you belong to.</p>
            </ActionForm>
          </section>
        )}
      </div>
    </Page>
  );
}
