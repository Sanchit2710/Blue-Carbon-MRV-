import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "ngo" | "company" | "admin";

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return data ? { ...data, email: user.email ?? "", role: data.role as Role } : null;
}

// Server-side gate for role areas. DB-level enforcement is RLS; this keeps wrong-role users out of the UI.
export async function requireRole(role: Role) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect("/dashboard");
  return profile;
}
