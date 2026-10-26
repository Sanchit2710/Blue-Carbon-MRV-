import { RoleShell, Planned } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

export default async function AdminPage() {
  const p = await requireRole("admin");
  return (
    <RoleShell title="Verifier dashboard" who={p.email}>
      <Planned items={["Verification queue + project review (Phase 3)", "Audit log viewer (Phase 3)", "Credit issuance authorization (Phase 4–5)"]} />
    </RoleShell>
  );
}
