"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Authoritative checks (admin only, conflict of interest, valid transitions) live in the SQL functions; requireRole is an early exit.
const clean = (m: string) => m.replace(/^.*?exception: /i, "");

export async function startReview(_: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = z.string().uuid().safeParse(form.get("project_id"));
  if (!id.success) return { error: "Invalid project" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_review", { p_project: id.data });
  if (error) return { error: clean(error.message) };
  revalidatePath(`/admin/projects/${id.data}`);
  return { notice: "Review started." };
}

const decisionSchema = z.object({
  project_id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "request_more_evidence"]),
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters"),
});

export async function reviewProject(_: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = decisionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_project", { p_project: parsed.data.project_id, p_decision: parsed.data.decision, p_reason: parsed.data.reason });
  if (error) return { error: clean(error.message) };
  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  revalidatePath("/admin");
  return { notice: `Decision recorded: ${parsed.data.decision.replaceAll("_", " ")}.` };
}

export async function reviewMaintenance(_: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z.object({ report_id: z.string().uuid(), outcome: z.enum(["verified", "flagged"]), notes: z.string().trim().min(5, "Notes required") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_maintenance", { p_report: parsed.data.report_id, p_outcome: parsed.data.outcome, p_notes: parsed.data.notes });
  if (error) return { error: clean(error.message) };
  revalidatePath("/admin/maintenance");
  return { notice: `Marked ${parsed.data.outcome}.` };
}

export async function markMissed(): Promise<FormState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_missed_maintenance");
  if (error) return { error: clean(error.message) };
  revalidatePath("/admin/maintenance");
  return { notice: `${data} overdue milestone(s) marked missed.` };
}
