import Link from "next/link";

export function AdminNav() {
  const link = "rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-stone-200";
  return (
    <nav className="mb-6 flex gap-2 border-b border-slate-200 pb-3" aria-label="Verifier sections">
      <Link href="/admin" className={link}>Review queue</Link>
      <Link href="/admin/maintenance" className={link}>Maintenance</Link>
      <Link href="/admin/audit" className={link}>Audit log</Link>
    </nav>
  );
}
