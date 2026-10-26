import Link from "next/link";

// Mark: a mangrove crown over a waterline.
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const c = tone === "light" ? "text-white" : "text-mangrove";
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 rounded-md font-display text-lg font-semibold tracking-tight ${c} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brackish`}>
      <svg viewBox="0 0 28 28" aria-hidden className="size-7">
        <path d="M14 4c-5 0-8 3.4-8 7 0 2.3 1.6 3.8 3.6 3.8 1.2 0 2.2-.5 2.9-1.3.4 1 1 1.6 1.5 1.6s1.1-.6 1.5-1.6c.7.8 1.7 1.3 2.9 1.3 2 0 3.6-1.5 3.6-3.8 0-3.6-3-7-8-7Z" fill="currentColor" />
        <path d="M14 15.5v5M14 17.5l-3.5 3M14 17.5l3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M3 21.5c2.2 0 2.2 1.5 4.4 1.5s2.2-1.5 4.4-1.5 2.2 1.5 4.4 1.5 2.2-1.5 4.4-1.5 2.2 1.5 4.4 1.5" stroke="#2f7c78" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      BlueCarbon
    </Link>
  );
}
