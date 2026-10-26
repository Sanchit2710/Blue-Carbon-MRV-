// Shown instantly on navigation while the page's data loads.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  const bar = "rounded-md bg-muted animate-pulse motion-reduce:animate-none";
  return (
    <div role="status" aria-label="Loading">
      <div className={`${bar} mb-3 h-9 w-64`} />
      <div className={`${bar} mb-10 h-5 w-96 max-w-full`} />
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 space-y-2"><div className={`${bar} h-4 w-1/2`} /><div className={`${bar} h-3.5 w-1/3`} /></div>
            <div className={`${bar} h-6 w-24 rounded-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}
