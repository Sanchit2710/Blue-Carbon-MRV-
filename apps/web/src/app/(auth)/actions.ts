"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type FormState = { error?: string; notice?: string };

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
  redirect("/dashboard");
}

const signupSchema = creds.extend({
  full_name: z.string().min(2, "Enter your name"),
  role: z.enum(["ngo", "company"]), // admin is never self-assignable
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, full_name, role } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, role } } });
  if (error) return { error: error.message };
  if (!data.session) return { notice: "Check your email to confirm your account, then log in." };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
