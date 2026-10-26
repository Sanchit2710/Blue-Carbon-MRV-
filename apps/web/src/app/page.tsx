import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Project = { id: string; name: string; ecosystem: string; region: string; area_hectares: number | null; is_demo: boolean };

async function approvedProjects(): Promise<Project[]> {
  if (!hasSupabaseEnv) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, ecosystem, region, area_hectares, is_demo")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function Home() {
  const projects = await approvedProjects();
  return (
    <>
      <header className="bg-slate-900 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold">BlueCarbon</span>
          <div className="flex gap-3 text-sm">
            <Link href="/login" className="rounded px-3 py-1.5 hover:bg-slate-800">Log in</Link>
            <Link href="/signup" className="rounded bg-teal-600 px-3 py-1.5 font-semibold hover:bg-teal-500">Register</Link>
          </div>
        </nav>
      </header>

      <section className="bg-emerald-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight">Verifiable monitoring for blue carbon restoration</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            NGOs submit evidence, authorized verifiers review it, and only approved projects reach the marketplace.
            Blockchain records ownership and retirement of credits; it does not prove a forest exists — verification does.
          </p>
          <div className="mt-8 flex gap-3">
            <a href="#projects" className="rounded bg-teal-600 px-5 py-2.5 font-semibold hover:bg-teal-500">Explore projects</a>
            <Link href="/signup" className="rounded border border-white/40 px-5 py-2.5 hover:bg-white/10">Register as NGO</Link>
          </div>
        </div>
      </section>

      <main id="projects" className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h2 className="mb-6 text-2xl font-semibold">Approved projects</h2>
        {!hasSupabaseEnv ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Backend not configured. Copy <code>.env.example</code> to <code>.env.local</code> and set the Supabase values.
          </p>
        ) : projects.length === 0 ? (
          <p className="text-slate-600">No approved projects yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-5">
                {p.is_demo && <span className="mb-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Demonstration data</span>}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-600 capitalize">{p.ecosystem.replace("_", " ")} · {p.region}{p.area_hectares ? ` · ${p.area_hectares} ha` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
