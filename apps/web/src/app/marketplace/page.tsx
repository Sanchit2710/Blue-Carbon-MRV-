import Image from "next/image";
import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { Spotlight } from "@/components/site/Spotlight";
import { qty } from "@/lib/format";
import { coverFor } from "@/lib/photos";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createClient } from "@/lib/supabase/server";

// Reads the session for the header; render per request.
export const instant = false;

const ecosystems: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };
type Row = { id: string; quantity_available: number; price_per_credit: number; is_demo: boolean; credit_batches: { period_start: string; period_end: string; methodology: string; issued_qty: number; projects: { id: string; name: string; ecosystem: string; region: string; area_hectares: number; is_demo: boolean; cover_url: string | null } } };

export default async function Marketplace({ searchParams }: PageProps<"/marketplace">) {
  const sp = await searchParams;
  const eco = typeof sp.ecosystem === "string" && sp.ecosystem in ecosystems ? sp.ecosystem : "";
  const region = typeof sp.region === "string" ? sp.region.trim().slice(0, 60) : "";
  const maxPrice = typeof sp.max === "string" && Number(sp.max) > 0 ? Number(sp.max) : null;

  const supabase = await createClient();
  const { data } = await supabase.from("marketplace_listings")
    .select("id, quantity_available, price_per_credit, is_demo, credit_batches!inner(period_start, period_end, methodology, issued_qty, projects!inner(id, name, ecosystem, region, area_hectares, is_demo, cover_url))")
    .eq("active", true).gt("quantity_available", 0).order("price_per_credit");
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
    const p = r.credit_batches.projects;
    return (!eco || p.ecosystem === eco) && (!region || p.region.toLowerCase().includes(region.toLowerCase())) && (maxPrice === null || Number(r.price_per_credit) <= maxPrice);
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <h1 className="text-4xl font-semibold text-mangrove">Marketplace</h1>
        <p className="mt-2 max-w-[62ch] text-lg text-muted-foreground">Credits from verifier-approved projects only. Prices are in Sepolia test ETH; nothing here is a legally recognised carbon credit.</p>

        <form className="mt-8 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" role="search">
          <label className="space-y-1.5 text-sm font-medium">Ecosystem
            <select name="ecosystem" defaultValue={eco} className="h-11 w-full rounded-lg border border-input bg-white px-3"><option value="">Any</option>{Object.entries(ecosystems).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">Region<input name="region" defaultValue={region} placeholder="e.g. West Bengal" className="h-11 w-full rounded-lg border border-input bg-white px-3" /></label>
          <label className="space-y-1.5 text-sm font-medium">Max price per tCO2e (ETH)<input name="max" type="number" step="any" min="0" defaultValue={maxPrice ?? ""} className="h-11 w-full rounded-lg border border-input bg-white px-3" /></label>
          <button className="h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98]">Filter</button>
        </form>

        {!rows.length ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-white/60 p-8">
            <p className="text-lg font-medium text-mangrove">{data?.length ? "No listings match these filters." : "Nothing is for sale yet."}</p>
            <p className="mt-1 text-muted-foreground">Listings appear when an NGO with approved, issued credits puts them up for sale.</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const p = r.credit_batches.projects;
              const share = Math.min(100, (Number(r.quantity_available) / Math.max(1, Number(r.credit_batches.issued_qty))) * 100);
              return (
                <li key={r.id}>
                  <Spotlight className="h-full rounded-2xl border border-border bg-white transition-colors hover:border-brackish">
                    <Link href={`/projects/${p.id}`} className="flex h-full flex-col focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brackish">
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image src={coverFor(p)} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" quality={75} className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-mangrove">{ecosystems[p.ecosystem]}</span>
                        {(p.is_demo || r.is_demo) && <span className="absolute right-3 top-3"><DemoBadge /></span>}
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <p className="font-display text-xl font-semibold leading-snug text-mangrove">{p.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{p.region}, {p.area_hectares} ha</p>
                        <p className="mt-1 text-sm text-muted-foreground">Credited {r.credit_batches.period_start} to {r.credit_batches.period_end}</p>
                        <div className="mt-auto pt-5">
                          <p className="tabular"><span className="font-display text-2xl font-semibold">{Number(r.price_per_credit)}</span> <span className="text-muted-foreground">ETH per tCO2e</span></p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${qty(r.quantity_available)} of ${qty(r.credit_batches.issued_qty)} tCO2e still available`}>
                            <div className="h-full rounded-full bg-brackish" style={{ width: `${share}%` }} />
                          </div>
                          <p className="tabular mt-1.5 text-sm text-muted-foreground">{qty(r.quantity_available)} of {qty(r.credit_batches.issued_qty)} tCO2e available</p>
                        </div>
                      </div>
                    </Link>
                  </Spotlight>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
