import { notFound } from "next/navigation";
import { BoundaryMap } from "@/components/BoundaryMap";
import { BuyCredits } from "@/components/chain/BuyCredits";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getProfile } from "@/lib/auth";
import { hasMarket } from "@/lib/chain/config";
import { parseBoundary } from "@/lib/evidence/geo";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const ecosystems: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };

// Public page for an approved project (RLS returns nothing for any other status).
export default async function ProjectDetails({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: boundary }, { data: batches }, viewerProfile] = await Promise.all([
    supabase.from("projects").select("id, name, description, ecosystem, region, species, area_hectares, planting_date, stewardship_start, stewardship_end, stewardship_responsible, is_demo, status").eq("id", id).eq("status", "approved").maybeSingle(),
    supabase.from("project_boundaries").select("geojson").eq("project_id", id).maybeSingle(),
    supabase.from("credit_batches").select("id, period_start, period_end, methodology, verification_ref, issued_qty, retired_qty, marketplace_listings(id, onchain_listing_id, quantity_available, price_per_credit, price_wei_per_unit, active)").eq("project_id", id).gt("issued_qty", 0).order("period_start"),
    getProfile(),
  ]);
  if (!project) notFound();
  const poly = boundary ? parseBoundary(JSON.stringify(boundary.geojson)) : null;
  const viewer = !viewerProfile ? { kind: "guest" as const } : viewerProfile.role !== "company" ? { kind: "other-role" as const } : { kind: "company" as const, wallet: viewerProfile.org?.wallet_address ?? null };
  const issued = (batches ?? []).reduce((s, b) => s + Number(b.issued_qty), 0);
  const retired = (batches ?? []).reduce((s, b) => s + Number(b.retired_qty), 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <p className="text-muted-foreground">{ecosystems[project.ecosystem]} in {project.region}{project.is_demo && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Demonstration data</span>}</p>
        <h1 className="mt-1 text-4xl font-semibold text-mangrove sm:text-5xl">{project.name}</h1>
        {project.description && <p className="mt-4 max-w-[64ch] text-lg leading-relaxed text-muted-foreground">{project.description}</p>}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-10">
            <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-white sm:grid-cols-4 sm:divide-x">
              {[["Area", `${project.area_hectares} ha`], ["Planted", project.planting_date], ["Issued", `${issued} tCO2e`], ["Retired", `${retired} tCO2e`]].map(([k, v]) => (
                <div key={k} className="px-5 py-4"><dt className="text-sm text-muted-foreground">{k}</dt><dd className="tabular mt-1 font-display text-xl font-semibold text-mangrove">{v}</dd></div>
              ))}
            </dl>
            <section>
              <h2 className="mb-3 text-2xl font-semibold text-mangrove">Who looks after the site</h2>
              <p className="max-w-[64ch] text-muted-foreground">{project.stewardship_responsible} is responsible for ten years of monitoring, from {project.stewardship_start} to {project.stewardship_end}, with annual reports checked by an independent verifier. Buying credits doesn’t move that responsibility to the buyer.</p>
              {project.species && <p className="mt-2 text-muted-foreground">Species planted: {project.species}.</p>}
            </section>
            {poly?.ok && <section><h2 className="mb-3 text-2xl font-semibold text-mangrove">Site boundary</h2><BoundaryMap polygon={poly.polygon} points={[]} /></section>}
          </div>

          <aside className="space-y-6">
            <h2 className="text-2xl font-semibold text-mangrove">Credits</h2>
            {!batches?.length ? <p className="text-muted-foreground">Approved. No credits have been issued yet.</p> : batches.map((b) => {
              const listings = ((b.marketplace_listings ?? []) as { id: string; onchain_listing_id: number; quantity_available: number; price_per_credit: number; price_wei_per_unit: string; active: boolean }[]).filter((l) => l.active && Number(l.quantity_available) > 0);
              return (
                <div key={b.id} className="space-y-4 rounded-xl border border-border bg-white p-5">
                  <div className="text-sm text-muted-foreground"><p className="tabular">Crediting period {b.period_start} to {b.period_end}</p><p>{b.methodology}. Verification: {b.verification_ref}</p></div>
                  {!listings.length ? <p className="text-sm text-muted-foreground">Not for sale right now.</p> : listings.map((l) => (
                    <div key={l.id} className="space-y-3 border-t border-border pt-4">
                      <p className="tabular"><span className="font-display text-2xl font-semibold">{Number(l.price_per_credit)}</span> <span className="text-muted-foreground">ETH per tCO2e, {Number(l.quantity_available)} available</span></p>
                      {hasMarket && <BuyCredits listingId={l.id} onchainListingId={Number(l.onchain_listing_id)} available={Number(l.quantity_available)} priceWeiPerUnit={l.price_wei_per_unit} viewer={viewer} />}
                    </div>
                  ))}
                </div>
              );
            })}
          </aside>
        </div>
      </main>
    </>
  );
}
