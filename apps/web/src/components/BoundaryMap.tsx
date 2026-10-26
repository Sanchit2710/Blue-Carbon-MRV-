import { ExternalLink } from "lucide-react";
import { bounds, centroid, polygonAreaHa, type Polygon } from "@/lib/evidence/geo";
import { SiteMapLazy } from "./map/SiteMapLazy";

export type MapPoint = { lat: number; lng: number; flagged: boolean };

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`;

// Interactive map of the registered boundary plus the numbers a reviewer can check independently.
export function BoundaryMap({ polygon, points, declaredHa }: { polygon: Polygon; points: MapPoint[]; declaredHa?: number | null }) {
  const c = centroid(polygon);
  const b = bounds(polygon);
  const area = polygonAreaHa(polygon);
  const diff = declaredHa ? Math.abs(area - declaredHa) / declaredHa : 0;
  const corners = polygon.coordinates[0].length - 1;
  return (
    <figure className="space-y-4">
      <div className="relative isolate z-0 h-[380px] overflow-hidden rounded-xl border border-border">
        <SiteMapLazy polygon={polygon} points={points} />
      </div>
      <dl className="grid gap-x-8 gap-y-2 rounded-xl border border-border bg-white p-5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Centre</dt>
        <dd className="tabular">{fmt(c.lat, "N", "S")}, {fmt(c.lng, "E", "W")}
          <span className="ml-3 inline-flex flex-wrap gap-3">
            <a href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=15/${c.lat}/${c.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">OpenStreetMap<ExternalLink className="size-3.5" aria-hidden /></a>
            <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">Google Maps<ExternalLink className="size-3.5" aria-hidden /></a>
          </span>
        </dd>
        <dt className="text-muted-foreground">Bounding box</dt>
        <dd className="tabular">{fmt(b.south, "N", "S")} to {fmt(b.north, "N", "S")}, {fmt(b.west, "E", "W")} to {fmt(b.east, "E", "W")}</dd>
        <dt className="text-muted-foreground">Boundary area</dt>
        <dd className="tabular">
          {area.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ha from the drawn boundary
          {declaredHa ? <> (declared {Number(declaredHa).toLocaleString("en-IN")} ha{diff > 0.15 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">differs by {Math.round(diff * 100)}%</span> : null})</> : null}
        </dd>
        <dt className="text-muted-foreground">Shape</dt>
        <dd>{corners} corner points, WGS84{points.length ? `; ${points.length} geotagged photo${points.length === 1 ? "" : "s"} plotted (green inside, red outside)` : ""}</dd>
      </dl>
    </figure>
  );
}
