import { AppShell } from "@/components/RoleShell";
import { requireRole } from "@/lib/auth";

// Auth-gated area: renders per request (session read), so skip the instant-navigation shell check.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/ngo">) {
  const p = await requireRole("ngo");
  return <AppShell who={p.email} role={p.role}>{children}</AppShell>;
}
