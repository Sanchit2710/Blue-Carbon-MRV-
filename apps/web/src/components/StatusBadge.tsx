const styles: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  submitted: "bg-sky-100 text-sky-900",
  under_review: "bg-indigo-100 text-indigo-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  requires_more_evidence: "bg-amber-100 text-amber-900",
  scheduled: "bg-slate-200 text-slate-800",
  verified: "bg-emerald-100 text-emerald-900",
  missed: "bg-red-100 text-red-900",
  flagged: "bg-red-100 text-red-900",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? styles.draft}`}>{status.replaceAll("_", " ")}</span>;
}
