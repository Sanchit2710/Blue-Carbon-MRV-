import { RoleShell, Planned } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

export default async function CompanyPage() {
  const p = await requireRole("company");
  return (
    <RoleShell title="Company dashboard" who={p.email}>
      <Planned items={["Marketplace purchases + wallet connection (Phase 5)", "Owned credits, history, retirement (Phase 5)"]} />
    </RoleShell>
  );
}
