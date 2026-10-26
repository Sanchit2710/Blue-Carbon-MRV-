// Pure geometry helpers (no deps). Coordinates are GeoJSON order: [lng, lat], WGS84.
export type Ring = [number, number][];
export type Polygon = { type: "Polygon"; coordinates: Ring[] };

export function parseBoundary(text: string): { ok: true; polygon: Polygon } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "Boundary is not valid JSON" }; }
  // accept Feature or bare Polygon
  const g = (raw as { type?: string; geometry?: unknown })?.type === "Feature" ? (raw as { geometry: unknown }).geometry : raw;
  const poly = g as Partial<Polygon> | null;
  if (poly?.type !== "Polygon" || !Array.isArray(poly.coordinates)) return { ok: false, error: "Boundary must be a GeoJSON Polygon" };
  const outer = poly.coordinates[0];
  if (!Array.isArray(outer) || outer.length < 4) return { ok: false, error: "Polygon ring needs at least 4 points" };
  for (const p of outer) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])
      || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) return { ok: false, error: "Coordinates must be [lng, lat] within range" };
  }
  const [a, b] = [outer[0], outer[outer.length - 1]];
  if (a[0] !== b[0] || a[1] !== b[1]) return { ok: false, error: "Polygon ring must be closed (first point = last point)" };
  return { ok: true, polygon: { type: "Polygon", coordinates: poly.coordinates.map((r) => r.map(([x, y]) => [x, y] as [number, number])) } };
}

function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Outer ring minus holes.
export function pointInPolygon(lng: number, lat: number, poly: Polygon) {
  const [outer, ...holes] = poly.coordinates;
  return inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h));
}
