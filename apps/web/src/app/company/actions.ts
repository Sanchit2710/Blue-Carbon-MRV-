"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const schema = z.object({
  name: z.string().trim().min(2),
  contact_email: z.string().email(),
  region: z.preprocess(blank, z.string().trim().max(100).optional()),
});

export async function createCompanyOrg(_: FormState, form: FormData): Promise<FormState> {
  const p = await requireRole("company");
  if (p.org) redirect("/company");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: org, error } = await supabase.from("organizations").insert({ ...parsed.data, type: "company", created_by: p.id }).select("id").single();
  if (error) return { error: error.message.replace(/^.*?exception: /i, "") };
  const { error: mErr } = await supabase.from("organization_members").insert({ organization_id: org.id, user_id: p.id });
  if (mErr) return { error: mErr.message };
  await supabase.rpc("log_audit", { p_action: "organization.create", p_entity: "organization", p_entity_id: org.id });
  redirect("/company");
}
