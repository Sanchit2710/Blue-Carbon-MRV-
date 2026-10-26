// Marks seeded demonstration data everywhere it appears.
export function DemoBadge({ label = "Demonstration data" }: { label?: string }) {
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-medium text-amber-900">{label}</span>;
}
