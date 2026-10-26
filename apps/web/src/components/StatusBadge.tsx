const styles: Record<string, [string, string]> = {
  draft: ["Draft", "bg-slate-200 text-slate-800"],
  submitted: ["Submitted", "bg-sky-100 text-sky-900"],
  under_review: ["Under review", "bg-indigo-100 text-indigo-900"],
  approved: ["Approved", "bg-emerald-100 text-emerald-900"],
  rejected: ["Rejected", "bg-red-100 text-red-900"],
  requires_more_evidence: ["More evidence needed", "bg-amber-100 text-amber-900"],
  scheduled: ["Scheduled", "bg-slate-200 text-slate-800"],
  verified: ["Verified", "bg-emerald-100 text-emerald-900"],
  missed: ["Missed", "bg-red-100 text-red-900"],
  flagged: ["Flagged", "bg-red-100 text-red-900"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = styles[status] ?? [status, styles.draft[1]];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${cls}`}>{label}</span>;
}
