import { redirect } from "next/navigation";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
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
    <RoleShell title="Register a restoration project" who={p.email} role={p.role}>
      <p className="-mt-4 mb-8 max-w-[62ch] text-lg text-muted-foreground">This creates a draft. You can add photos and check everything before sending it to a verifier.</p>
      <ActionForm action={createProject} submitLabel="Create draft project" pendingLabel="Creating…" className="max-w-2xl space-y-5 rounded-xl border border-border bg-white p-6">
        <input type="hidden" name="organization_id" value={org.id} />
        <label className={labelClass}>Project name<input name="name" required minLength={3} className={fieldClass} /></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>Ecosystem
            <select name="ecosystem" className={fieldClass}>
              <option value="mangrove">Mangrove</option><option value="seagrass">Seagrass</option>
              <option value="salt_marsh">Salt marsh</option><option value="other">Other</option>
            </select>
          </label>
          <label className={labelClass}>Location<input name="region" required className={fieldClass} /></label>
          <label className={labelClass}>Species<input name="species" className={fieldClass} /></label>
          <label className={labelClass}>Area (hectares)<input name="area_hectares" type="number" step="0.01" min="0.01" required className={fieldClass} /></label>
          <label className={labelClass}>Planting date<input name="planting_date" type="date" required className={fieldClass} /></label>
          <label className={labelClass}>Monitoring starts (10 years)<input name="stewardship_start" type="date" required className={fieldClass} /></label>
        </div>
        <label className={labelClass}>Description<textarea name="description" rows={3} className={fieldClass} /></label>
        <label className={labelClass}>Site boundary (GeoJSON polygon)
          <textarea name="boundary" rows={5} required defaultValue={example} className={`${fieldClass} font-mono text-sm`} />
          <span className="block font-normal text-muted-foreground">The example above is a placeholder. Replace it with your surveyed boundary as [longitude, latitude] points, ending where it started.</span>
        </label>
        <p className="text-sm text-muted-foreground">Your organisation is recorded as responsible for stewardship. Buyer or landholder obligations are set in separate agreements, not here.</p>
      </ActionForm>
    </RoleShell>
  );
}
