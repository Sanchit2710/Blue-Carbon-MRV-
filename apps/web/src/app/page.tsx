import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, ClipboardCheck, Sprout, Waypoints } from "lucide-react";
import { DemoBadge } from "@/components/DemoBadge";
import { CountUp } from "@/components/site/CountUp";
import { Hero } from "@/components/site/Hero";
import { Logo } from "@/components/site/Logo";
import { ProjectAccordion } from "@/components/site/ProjectAccordion";
import { WaterlineReveal } from "@/components/site/WaterlineReveal";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { coverFor, photos } from "@/lib/photos";

const steps = [
  { title: "Register the site", body: "Draw the boundary, record species, area and planting date. Details lock once submitted, so nothing shifts under review." },
  { title: "Send evidence from the field", body: "Take photos in the app. Each original is kept at full quality with its fingerprint, location and time, and anything unusual is flagged." },
  { title: "Independent review", body: "A verifier from outside your organisation approves, rejects or asks for more — and the reason is on record for everyone involved." },
  { title: "Ten years of monitoring", body: "Approval opens an annual monitoring schedule. Reports are reviewed; missed ones are flagged, never quietly dropped." },
];

const ecosystemName: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };

function NotConnected() {
  return <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The database isn’t connected yet. Add the Supabase values to <code>.env.local</code>.</p>;
}

async function Stats() {
  if (!hasSupabaseEnv) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_stats");
  const s = data?.[0];
  if (!s || !s.projects) return null;
  const items = [
    { label: "approved restoration projects", value: Number(s.projects), d: 0 },
    { label: "hectares under restoration", value: Number(s.hectares), d: 0 },
    { label: "tCO2e issued", value: Number(s.issued), d: 0 },
    { label: "tCO2e retired", value: Number(s.retired), d: 0 },
  ];
  return (
    <section className="border-b border-border bg-white">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <dl className="grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-border">
          {items.map((i) => (
            <div key={i.label} className="md:px-6 md:first:pl-0">
              <dd className="font-display text-4xl font-semibold text-mangrove sm:text-5xl"><CountUp value={i.value} decimals={i.d} /></dd>
              <dt className="mt-1 text-muted-foreground">{i.label}</dt>
            </div>
          ))}
        </dl>
        {s.has_demo && <p className="mt-6 text-sm text-muted-foreground"><DemoBadge /> These totals include demonstration data.</p>}
      </div>
    </section>
  );
}

async function Featured() {
  if (!hasSupabaseEnv) return <NotConnected />;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, ecosystem, region, area_hectares, cover_url, is_demo").eq("status", "approved").order("created_at", { ascending: false }).limit(4);
  if (!data?.length) return (
    <div className="rounded-xl border border-dashed border-border bg-white/60 p-8">
      <p className="text-lg font-medium text-mangrove">No projects have been approved yet.</p>
      <p className="mt-1 text-muted-foreground">Approved restoration sites appear here as soon as a verifier signs them off.</p>
    </div>
  );
  return <ProjectAccordion projects={data.map((p) => ({ id: p.id, name: p.name, region: p.region, ecosystem: ecosystemName[p.ecosystem] ?? p.ecosystem, hectares: Number(p.area_hectares), cover: coverFor(p), demo: p.is_demo }))} />;
}

const roles = [
  { icon: Sprout, title: "NGOs and panchayats", body: "Register sites, send geotagged evidence straight from the field, link a wallet and sell credits once they’re issued.", href: "/signup", cta: "Register a project", photo: photos.roots },
  { icon: ClipboardCheck, title: "Verifiers", body: "Review evidence with automatic flags, decide with a reason on record, and sign issuance with your own wallet.", href: "/login", cta: "Verifier log in" },
  { icon: Building2, title: "Companies", body: "Buy credits from approved projects, retire them for a claim, and share a public certificate anyone can check.", href: "/marketplace", cta: "Browse the marketplace" },
  { icon: Waypoints, title: "Anyone", body: "Every decision is in the audit trail, and every issuance, sale and retirement links to its transaction.", href: "/marketplace", cta: "See what’s listed" },
];

export default function Home() {
  return (
    <>
      <Hero />
      <Suspense fallback={<div className="h-40 border-b border-border bg-white" />}><Stats /></Suspense>

      <section id="projects" className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-24 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-semibold text-mangrove sm:text-5xl">Approved projects</h2>
            <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">Only sites a verifier has signed off appear here. Open one to see its boundary, stewardship and credits.</p>
          </div>
          <Link href="/marketplace" className="font-medium text-mangrove underline underline-offset-4">Browse the marketplace</Link>
        </div>
        <Suspense fallback={<div className="h-[440px] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />}><Featured /></Suspense>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <div className="lg:sticky lg:top-12 lg:self-start">
          <h2 className="text-4xl font-semibold leading-tight text-mangrove sm:text-5xl">How a project earns trust</h2>
          <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">Four stages, in this order. Each one leaves a record the next person can check.</p>
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

      <section id="waterline" className="scroll-mt-0 bg-estuary py-24 text-white">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 className="max-w-[20ch] text-4xl font-semibold leading-tight sm:text-5xl">Above and below the waterline</h2>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-white/80">
            A ledger can show who owns a credit and when it was retired. It cannot show that a tree is alive. That part is done by evidence from the site and by people who check it — so that is where BlueCarbon starts.
          </p>
        </div>
        <div className="mx-auto mt-12 w-full max-w-7xl px-5 sm:px-8"><WaterlineReveal /></div>
      </section>

      <section id="roles" className="mx-auto w-full max-w-6xl scroll-mt-0 px-5 py-24 sm:px-8">
        <h2 className="text-4xl font-semibold text-mangrove sm:text-5xl">One record, four kinds of people</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3 md:grid-rows-2">
          {roles.map((r, i) => (
            <Link key={r.title} href={r.href} className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl border border-border p-6 transition-colors hover:border-brackish ${i === 0 ? "min-h-80 text-white md:row-span-2" : "bg-white"} ${i === roles.length - 1 ? "md:col-span-2" : ""}`}>
              {r.photo && <>
                <Image src={r.photo.src} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" quality={80} className="-z-10 object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
                <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(14,34,54,0.92),rgba(14,34,54,0.2)_70%)]" />
              </>}
              <r.icon className={`mb-auto size-7 ${i === 0 ? "text-white" : "text-brackish"}`} aria-hidden />
              <h3 className={`mt-8 text-2xl font-semibold ${i === 0 ? "" : "text-mangrove"}`}>{r.title}</h3>
              <p className={`mt-2 max-w-[48ch] ${i === 0 ? "text-white/85" : "text-muted-foreground"}`}>{r.body}</p>
              <span className={`mt-4 font-medium underline-offset-4 group-hover:underline ${i === 0 ? "" : "text-mangrove"}`}>{r.cta}</span>
            </Link>
          ))}
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
