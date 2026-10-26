"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

// Inside a <Link>: chevron normally, spinner while that link's navigation is in flight.
export function LinkPending({ className = "size-5" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending
    ? <Loader2 className={`${className} animate-spin text-brackish`} aria-label="Loading" />
    : <ChevronRight className={`${className} text-muted-foreground transition-transform group-hover:translate-x-0.5`} aria-hidden />;
}
