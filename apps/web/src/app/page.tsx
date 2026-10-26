import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Hero } from "@/components/site/Hero";
import { Logo } from "@/components/site/Logo";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { photos } from "@/lib/photos";

const steps = [
  { title: "Register the site", body: "Draw the boundary, record species, area and planting date. Details lock once submitted, so nothing shifts under review." },
  { title: "Send evidence from the field", body: "Take photos in the app. Each original is kept at full quality with its fingerprint, location and time, and anything unusual is flagged." },
  { title: "Independent review", body: "A verifier from outside your organisation approves, rejects or asks for more — and the reason is on record for everyone involved." },
  { title: "Ten years of monitoring", body: "Approval opens an annual monitoring schedule. Reports are reviewed; missed ones are flagged, never quietly dropped." },
];

const ecosystemName: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };

async function ApprovedProjects() {
  if (!hasSupabaseEnv) return <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The database isn’t connected yet. Add the Supabase values to <code>.env.local</code>.</p>;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, ecosystem, region, area_hectares, is_demo").eq("status", "approved").order("created_at", { ascending: false });
  if (!data?.length) return (
    <div className="rounded-xl border border-dashed border-border bg-white/60 p-8">
      <p className="text-lg font-medium text-mangrove">No projects have been approved yet.</p>
      <p className="mt-1 text-muted-foreground">Approved restoration sites appear here as soon as a verifier signs them off.</p>
    </div>
  );
  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((p) => (
        <li key={p.id} className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline">
          <div>
            <p className="font-display text-xl font-semibold text-mangrove">{p.name}</p>
            <p className="text-muted-foreground">{ecosystemName[p.ecosystem] ?? p.ecosystem} in {p.region}</p>
          </div>
          <p className="tabular text-muted-foreground sm:text-right">
            {p.area_hectares ? <><span className="text-lg font-semibold text-foreground">{p.area_hectares}</span> ha</> : null}
            {p.is_demo && <span className="ml-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Demonstration data</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <div className="lg:sticky lg:top-12 lg:self-start">
          <h2 className="text-4xl font-semibold leading-tight text-mangrove sm:text-5xl">How a project earns trust</h2>
          <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">Four stages, in this order. Each one leaves a record the next person can check.</p>
          <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden rounded-xl lg:block">
            <Image src={photos.roots.src} alt={photos.roots.alt} fill sizes="40vw" quality={85} className="object-cover" />
          </div>
        </div>
        <ol className="space-y-12">
          {steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-border pt-8">
              <span aria-hidden className="font-display text-4xl font-semibold leading-none text-brackish">{i + 1}</span>
              <div>
                <h3 className="text-2xl font-semibold text-mangrove">{s.title}</h3>
                <p className="mt-2 max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-estuary text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image src={photos.underwater.src} alt={photos.underwater.alt} fill sizes="(min-width: 768px) 50vw, 100vw" quality={85} className="object-cover" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Above and below the waterline</h2>
            <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-white/80">
              A ledger can show who owns a credit and when it was retired. It cannot show that a tree is alive. That part is done by evidence from the site and by people who check it — so that is where BlueCarbon starts.
            </p>
          </div>
        </div>
      </section>

      <section id="projects" className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-24 sm:px-8">
        <h2 className="text-4xl font-semibold text-mangrove">Approved projects</h2>
        <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">Only projects a verifier has approved are listed. Credit sales open in a later release.</p>
        <div className="mt-10">
          <Suspense fallback={<p className="text-muted-foreground">Loading projects…</p>}><ApprovedProjects /></Suspense>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p>Photography from Unsplash by {[photos.hero, photos.roots, photos.underwater].map((p) => p.credit).join(", ")}.</p>
          <Link href="/signup" className="font-medium text-mangrove underline-offset-4 hover:underline">Create an account</Link>
        </div>
      </footer>
    </>
  );
}
