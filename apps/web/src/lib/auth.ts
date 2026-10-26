import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "ngo" | "company" | "admin";
export type Org = { id: string; name: string; region: string | null; wallet_address: string | null };

// One call per request (React cache): the session JWT is verified locally against the project's
// published ES256 keys (getClaims), then profile + organisation come back in a single query.
export const getProfile = cache(async () => {
  await connection(); // session checks read the clock; keep this out of prerendering
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("id, role, full_name, organization_members(organizations(id, name, region, wallet_address))")
    .eq("id", claims.sub)
    .single();
  if (!row) return null;
  const members = row.organization_members as unknown as { organizations: Org | null }[] | null;
  return {
    id: row.id as string,
    role: row.role as Role,
    full_name: row.full_name as string | null,
    email: typeof claims.email === "string" ? claims.email : "",
    org: members?.[0]?.organizations ?? null,
  };
});

// Server-side gate for role areas. DB-level enforcement is RLS; this keeps wrong-role users out of the UI.
export async function requireRole(role: Role) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(`/${profile.role}`);
  return profile;
}
