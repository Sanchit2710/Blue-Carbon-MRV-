import { Page, Planned } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

export default async function CompanyPage() {
  await requireRole("company");
  return (
    <Page title="Company dashboard">
      <Planned items={["Marketplace purchases + wallet connection (Phase 5)", "Owned credits, history, retirement (Phase 5)"]} />
    </Page>
  );
}
