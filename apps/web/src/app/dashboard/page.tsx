import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

// Redirect-only route that reads the session.
export const instant = false;

export default async function DashboardRouter() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(`/${profile.role}`);
}
