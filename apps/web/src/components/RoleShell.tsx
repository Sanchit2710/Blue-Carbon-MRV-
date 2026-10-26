import Link from "next/link";
import { logout } from "@/app/(auth)/actions";

export function RoleShell({ title, who, children }: { title: string; who: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-bold">BlueCarbon</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">{who}</span>
            <form action={logout}><button className="rounded border border-slate-500 px-3 py-1 hover:bg-slate-800">Log out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Planned({ items }: { items: string[] }) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Not built yet</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}
