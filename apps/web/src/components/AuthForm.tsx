"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function AuthForm({ action, mode }: { action: (s: FormState, f: FormData) => Promise<FormState>; mode: "login" | "signup" }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {mode === "signup" && (
        <>
          <label className="block text-sm font-medium">Full name
            <input name="full_name" required autoComplete="name" className={`${input} mt-1`} />
          </label>
          <label className="block text-sm font-medium">I am registering as
            <select name="role" className={`${input} mt-1`} defaultValue="ngo">
              <option value="ngo">NGO / Panchayat (restoration project owner)</option>
              <option value="company">Company (credit buyer)</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-sm font-medium">Email
        <input name="email" type="email" required autoComplete="email" className={`${input} mt-1`} />
      </label>
      <label className="block text-sm font-medium">Password
        <input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${input} mt-1`} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.notice && <p role="status" className="text-sm text-teal-800">{state.notice}</p>}
      <button disabled={pending} className="w-full rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
