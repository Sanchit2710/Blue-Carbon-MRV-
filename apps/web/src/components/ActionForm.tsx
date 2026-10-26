"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function ActionForm({ action, submitLabel, pendingLabel, children, className = "space-y-5", variant }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div aria-live="polite">
        {state.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
        {state.notice && <p className="rounded-lg border border-teal-200 bg-accent px-4 py-3 text-sm text-mangrove">{state.notice}</p>}
      </div>
      <Button type="submit" disabled={pending} variant={variant}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? pendingLabel ?? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

export const fieldClass = "w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-11";
export const labelClass = "block space-y-2 text-sm font-medium text-foreground";
