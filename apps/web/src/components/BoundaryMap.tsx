import type { Polygon } from "@/lib/evidence/geo";

export type MapPoint = { lat: number; lng: number; flagged: boolean };

// Schematic SVG: boundary + photo GPS points on a local equirectangular projection. No basemap or tiles.
export function BoundaryMap({ polygon, points }: { polygon: Polygon; points: MapPoint[] }) {
  const ring = polygon.coordinates[0];
  const lats = [...ring.map((p) => p[1]), ...points.map((p) => p.lat)];
  const lngs = [...ring.map((p) => p[0]), ...points.map((p) => p.lng)];
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const w = Math.max((maxLng - minLng) * k, 1e-6), h = Math.max(maxLat - minLat, 1e-6);
  const S = 400, pad = 20, scale = (S - 2 * pad) / Math.max(w, h);
  const x = (lng: number) => pad + (lng - minLng) * k * scale;
  const y = (lat: number) => pad + (maxLat - lat) * scale;
  return (
    <figure>
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Project boundary and photo locations" className="w-full max-w-md rounded-xl border border-border bg-[#e4eef0]">
        {polygon.coordinates.map((r, i) => (
          <polygon key={i} points={r.map(([lng, lat]) => `${x(lng)},${y(lat)}`).join(" ")} fill={i === 0 ? "rgba(5,100,70,0.18)" : "white"} stroke="#065f46" strokeWidth="2" />
        ))}
        {points.map((p, i) => <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r="5" fill={p.flagged ? "#b91c1c" : "#0f766e"} stroke="white" strokeWidth="1.5" />)}
      </svg>
      <figcaption className="mt-2 text-sm text-muted-foreground">Schematic drawing, no map underneath. Teal dots are inside the boundary, red dots outside. {points.length} geotagged photo(s) plotted.</figcaption>
    </figure>
  );
}
