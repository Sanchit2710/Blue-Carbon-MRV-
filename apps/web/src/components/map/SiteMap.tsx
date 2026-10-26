"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polygon as LPolygon, TileLayer, Tooltip } from "react-leaflet";
import type { Polygon } from "@/lib/evidence/geo";

export type MapPoint = { lat: number; lng: number; flagged: boolean };

// OpenStreetMap tiles (free, attribution required). Boundary in teal; photo locations as dots.
export default function SiteMap({ polygon, points }: { polygon: Polygon; points: MapPoint[] }) {
  const rings = polygon.coordinates.map((r) => r.map(([lng, lat]) => [lat, lng] as [number, number]));
  const all = [...rings[0], ...points.map((p) => [p.lat, p.lng] as [number, number])];
  const lats = all.map((p) => p[0]), lngs = all.map((p) => p[1]);
  return (
    <MapContainer
      bounds={[[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]}
      boundsOptions={{ padding: [28, 28] }}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <LPolygon positions={rings} pathOptions={{ color: "#065f46", weight: 2.5, fillColor: "#2f7c78", fillOpacity: 0.22 }} />
      {points.map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: p.flagged ? "#b91c1c" : "#0f766e", fillOpacity: 1 }}>
          <Tooltip>{p.flagged ? "Photo taken outside the boundary" : "Photo taken inside the boundary"} ({p.lat.toFixed(5)}, {p.lng.toFixed(5)})</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
