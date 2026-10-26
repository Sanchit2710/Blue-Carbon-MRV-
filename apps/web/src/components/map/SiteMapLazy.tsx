"use client";

import dynamic from "next/dynamic";

// Leaflet needs the browser (window), so the map is loaded client-side only.
export const SiteMapLazy = dynamic(() => import("./SiteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted motion-reduce:animate-none" />,
});
