import Link from "next/link";
import { Plus } from "lucide-react";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { ProjectRow } from "@/components/ProjectRow";
import { RoleShell } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

export default async function NgoPage() {
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name, region").limit(1).maybeSingle();

  if (!org) {
    return (
      <RoleShell title="Set up your organisation" who={p.email} role={p.role}>
        <p className="-mt-4 mb-8 max-w-[60ch] text-lg text-muted-foreground">Projects are registered under your organisation, so verifiers know who is responsible for the site.</p>
        <ActionForm action={createOrganization} submitLabel="Save organisation" className="max-w-lg space-y-5 rounded-xl border border-border bg-white p-6">
          <label className={labelClass}><span>Organisation name</span><input name="name" required className={fieldClass} /></label>
          <label className={labelClass}><span>Type</span>
            <select name="type" className={fieldClass}><option value="ngo">NGO</option><option value="panchayat">Panchayat or community body</option></select>
          </label>
          <label className={labelClass}><span>State or district</span><input name="region" required className={fieldClass} /></label>
          <label className={labelClass}><span>Contact email</span><input name="contact_email" type="email" required className={fieldClass} /></label>
          <label className={labelClass}><span>Contact phone <span className="font-normal text-muted-foreground">(optional)</span></span><input name="contact_phone" type="tel" className={fieldClass} /></label>
        </ActionForm>
      </RoleShell>
    );
  }

  const { data: projects } = await supabase.from("projects").select("id, name, status, ecosystem, region, area_hectares").eq("organization_id", org.id).order("created_at", { ascending: false });
  return (
    <RoleShell title={org.name} who={p.email} role={p.role}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-mangrove">Projects</h2>
        <Button asChild><Link href="/ngo/projects/new"><Plus className="size-5" aria-hidden />Register a project</Link></Button>
      </div>
      {!projects?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-white/60 p-8">
          <p className="text-lg font-medium text-mangrove">Register your first restoration site.</p>
          <p className="mt-1 max-w-[56ch] text-muted-foreground">You’ll need the site boundary, area, species and planting date. Photos come after.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {projects.map((pr) => <ProjectRow key={pr.id} href={`/ngo/projects/${pr.id}`} name={pr.name} ecosystem={pr.ecosystem} region={pr.region} extra={`${pr.area_hectares} ha`} status={pr.status} />)}
        </ul>
      )}
      <p className="mt-8 text-sm text-muted-foreground">Credits, sales and payouts will show here once credit issuance is switched on.</p>
    </RoleShell>
  );
}
