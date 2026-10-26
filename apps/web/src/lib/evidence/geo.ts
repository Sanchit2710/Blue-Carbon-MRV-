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

// Great-circle distance in metres (haversine).
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// Area of the outer ring minus holes, in hectares. Local equirectangular projection around the
// ring's mean latitude: accurate to well under 1% for sites of a few km, which is what we register.
export function polygonAreaHa(poly: Polygon) {
  const ringArea = (ring: Ring) => {
    const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
    const kx = 111_320 * Math.cos(lat0), ky = 110_574;
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * kx * (ring[i][1] * ky) - ring[i][0] * kx * (ring[j][1] * ky);
    return Math.abs(a) / 2;
  };
  const [outer, ...holes] = poly.coordinates;
  return (ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0)) / 10_000;
}

// Mean of the outer ring's distinct vertices: a good "go to" point for small, compact sites.
export function centroid(poly: Polygon) {
  const ring = poly.coordinates[0].slice(0, -1);
  return { lat: ring.reduce((s, p) => s + p[1], 0) / ring.length, lng: ring.reduce((s, p) => s + p[0], 0) / ring.length };
}

export function bounds(poly: Polygon) {
  const ring = poly.coordinates[0];
  const lats = ring.map((p) => p[1]), lngs = ring.map((p) => p[0]);
  return { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) };
}
