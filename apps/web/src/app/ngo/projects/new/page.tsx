import { redirect } from "next/navigation";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { RoleShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "../../actions";

const example = `{"type":"Polygon","coordinates":[[[88.80,21.90],[88.82,21.90],[88.82,21.92],[88.80,21.92],[88.80,21.90]]]}`;

export default async function NewProjectPage() {
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
  if (!org) redirect("/ngo");
  return (
    <RoleShell title="Register a restoration project" who={p.email}>
      <ActionForm action={createProject} submitLabel="Create draft project" className="max-w-2xl space-y-4">
        <input type="hidden" name="organization_id" value={org.id} />
        <label className="block text-sm font-medium">Project name<input name="name" required minLength={3} className={`${fieldClass} mt-1`} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Ecosystem
            <select name="ecosystem" className={`${fieldClass} mt-1`}>
              <option value="mangrove">Mangrove</option><option value="seagrass">Seagrass</option>
              <option value="salt_marsh">Salt marsh</option><option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Region / location<input name="region" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Species<input name="species" className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Area (hectares)<input name="area_hectares" type="number" step="0.01" min="0.01" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Planting date<input name="planting_date" type="date" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Stewardship start (10-year commitment)<input name="stewardship_start" type="date" required className={`${fieldClass} mt-1`} /></label>
        </div>
        <label className="block text-sm font-medium">Description<textarea name="description" rows={3} className={`${fieldClass} mt-1`} /></label>
        <label className="block text-sm font-medium">Project boundary (GeoJSON Polygon, [longitude, latitude], WGS84)
          <textarea name="boundary" rows={5} required defaultValue={example} className={`${fieldClass} mt-1 font-mono text-xs`} />
          <span className="mt-1 block text-xs font-normal text-slate-500">The value above is a placeholder example, replace it with your surveyed boundary. A map drawing tool is not built yet.</span>
        </label>
        <p className="text-xs text-slate-500">Stewardship responsibility defaults to your organization. Any buyer or landholder obligations are set by separate agreements, not by this form.</p>
      </ActionForm>
    </RoleShell>
  );
}
