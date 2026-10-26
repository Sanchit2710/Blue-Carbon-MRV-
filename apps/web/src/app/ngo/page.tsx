import { RoleShell, Planned } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NgoPage() {
  const p = await requireRole("ngo");
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name, status").order("created_at", { ascending: false });
  return (
    <RoleShell title="NGO / Panchayat dashboard" who={p.email}>
      <p className="mb-4 text-sm text-slate-600">Your projects (read from the database, filtered by RLS): {projects?.length ?? 0}</p>
      <Planned items={["Organization registration (Phase 2)", "Project registration + boundary (Phase 2)", "Evidence upload with SHA-256/EXIF checks (Phase 2)", "Maintenance reports (Phase 2)"]} />
    </RoleShell>
  );
}
