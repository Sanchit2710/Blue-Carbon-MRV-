"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roles = [
  { value: "ngo", title: "NGO or panchayat", body: "I run a restoration site and submit evidence." },
  { value: "company", title: "Company", body: "I want to review projects and fund verified restoration." },
];

export function AuthForm({ action, mode }: { action: (s: FormState, f: FormData) => Promise<FormState>; mode: "login" | "signup" }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [show, setShow] = useState(false);
  return (
    <form action={formAction} className="space-y-6" noValidate={false}>
      {mode === "signup" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" required autoComplete="name" />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">I’m joining as</legend>
            <div className="grid gap-3">
              {roles.map((r, i) => (
                <label key={r.value} className="flex cursor-pointer gap-3 rounded-lg border border-input bg-white p-4 transition-colors has-[:checked]:border-brackish has-[:checked]:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                  <input type="radio" name="role" value={r.value} defaultChecked={i === 0} className="mt-1 size-4 accent-[#2f7c78]" />
                  <span><span className="block font-medium text-mangrove">{r.title}</span><span className="block text-sm text-muted-foreground">{r.body}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} required minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"} className="pr-12"
            aria-describedby={mode === "signup" ? "password-hint" : undefined} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brackish">
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {mode === "signup" && <p id="password-hint" className="text-sm text-muted-foreground">At least 8 characters.</p>}
      </div>
      <div aria-live="polite">
        {state.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
        {state.notice && <p className="rounded-lg border border-teal-200 bg-accent px-4 py-3 text-sm text-mangrove">{state.notice}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {pending ? (mode === "login" ? "Logging in…" : "Creating account…") : mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}
