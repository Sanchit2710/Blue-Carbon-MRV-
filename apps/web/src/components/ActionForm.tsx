"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";

export function ActionForm({ action, submitLabel, children, className = "space-y-4" }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.notice && <p role="status" className="whitespace-pre-line text-sm text-teal-800">{state.notice}</p>}
      <button disabled={pending} className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

export const fieldClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
