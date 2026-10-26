import Link from "next/link";
import { ActionForm, fieldClass } from "@/components/ActionForm";
import { RoleShell } from "@/components/RoleShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

export default async function NgoPage() {
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name, region").limit(1).maybeSingle();

  if (!org) {
    return (
      <RoleShell title="Register your organization" who={p.email}>
        <ActionForm action={createOrganization} submitLabel="Register organization" className="max-w-lg space-y-4">
          <label className="block text-sm font-medium">Organization name<input name="name" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Type
            <select name="type" className={`${fieldClass} mt-1`}><option value="ngo">NGO</option><option value="panchayat">Panchayat / community body</option></select>
          </label>
          <label className="block text-sm font-medium">Region<input name="region" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Contact email<input name="contact_email" type="email" required className={`${fieldClass} mt-1`} /></label>
          <label className="block text-sm font-medium">Contact phone (optional)<input name="contact_phone" className={`${fieldClass} mt-1`} /></label>
        </ActionForm>
      </RoleShell>
    );
  }

  const { data: projects } = await supabase.from("projects").select("id, name, status, ecosystem, region").eq("organization_id", org.id).order("created_at", { ascending: false });
  return (
    <RoleShell title={org.name} who={p.email}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Link href="/ngo/projects/new" className="rounded bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">New project</Link>
      </div>
      {!projects?.length ? <p className="text-sm text-slate-600">No projects yet.</p> : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {projects.map((pr) => (
            <li key={pr.id}>
              <Link href={`/ngo/projects/${pr.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                <span><span className="font-medium">{pr.name}</span> <span className="text-sm text-slate-500 capitalize">· {pr.ecosystem.replace("_", " ")} · {pr.region}</span></span>
                <StatusBadge status={pr.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-slate-500">Credits, sales and payouts appear here once projects are approved and issued (Phase 4–5).</p>
    </RoleShell>
  );
}
