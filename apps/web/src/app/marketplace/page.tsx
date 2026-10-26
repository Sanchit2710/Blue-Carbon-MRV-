import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createClient } from "@/lib/supabase/server";

// Reads the session for the header; render per request.
export const instant = false;

const ecosystems: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };
type Row = { id: string; quantity_available: number; price_per_credit: number; credit_batches: { period_start: string; period_end: string; methodology: string; projects: { id: string; name: string; ecosystem: string; region: string; area_hectares: number; is_demo: boolean } } };

export default async function Marketplace({ searchParams }: PageProps<"/marketplace">) {
  const sp = await searchParams;
  const eco = typeof sp.ecosystem === "string" && sp.ecosystem in ecosystems ? sp.ecosystem : "";
  const region = typeof sp.region === "string" ? sp.region.trim().slice(0, 60) : "";
  const maxPrice = typeof sp.max === "string" && Number(sp.max) > 0 ? Number(sp.max) : null;

  const supabase = await createClient();
  const { data } = await supabase.from("marketplace_listings")
    .select("id, quantity_available, price_per_credit, credit_batches!inner(period_start, period_end, methodology, projects!inner(id, name, ecosystem, region, area_hectares, is_demo))")
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
          <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {rows.map((r) => {
              const p = r.credit_batches.projects;
              return (
                <li key={r.id}>
                  <Link href={`/projects/${p.id}`} className="grid gap-3 px-5 py-5 hover:bg-muted/60 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-display text-xl font-semibold text-mangrove">{p.name}{p.is_demo && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-900">Demonstration data</span>}</p>
                      <p className="text-muted-foreground">{ecosystems[p.ecosystem]} in {p.region}, {p.area_hectares} ha. Credited {r.credit_batches.period_start} to {r.credit_batches.period_end} under {r.credit_batches.methodology}.</p>
                    </div>
                    <div className="tabular sm:text-right">
                      <p><span className="font-display text-2xl font-semibold">{Number(r.price_per_credit)}</span> <span className="text-muted-foreground">ETH per tCO2e</span></p>
                      <p className="text-sm text-muted-foreground">{Number(r.quantity_available)} tCO2e available</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
