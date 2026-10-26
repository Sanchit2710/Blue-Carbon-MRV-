# UI stack and field features

## UI stack (chosen after comparing shadcn/ui, Magic UI, Aceternity UI, React Bits, Origin UI/coss, Uiverse, Hover.dev)
- **shadcn/ui (Radix base)**: accessible primitives copied into `src/components/ui`. Every other registry (Magic UI, Aceternity, 21st.dev, coss) is shadcn-compatible, so any of their components can be added later with `npx shadcn add <url>`.
- **Motion (`motion/react`)**: only for motion that answers a user action (capture panel transitions). The landing hero's one entrance animation is pure CSS so the headline never waits for JavaScript; `prefers-reduced-motion` is respected.
- **lucide-react** icons. Fonts: Bricolage Grotesque (headings), Public Sans (body, tabular numbers).
- Not adopted: decorative effect packs (meteors, sparkles, shimmer). They work against a product whose job is credibility; revisit for specific needs (e.g. Number Ticker once real tonnage stats exist).
- Photos: Unsplash License (free commercial use), photographers credited on the page. Registry in `src/lib/photos.ts`; replace with the project's own field photography when available.

## Field capture (implemented)
- "Take photo" opens the phone's native camera (`capture="environment"`): full sensor resolution, EXIF intact. The file is uploaded exactly as captured — no canvas, no recompression — so the stored SHA-256 matches the original.
- Phone location (`navigator.geolocation`, high accuracy) is recorded at capture time alongside photo EXIF GPS. iOS often strips GPS from browser uploads, so this second signal matters. Both are client-side and can be spoofed; verifiers see which source was used.
- New flags: `location_from_device`, `device_gps_mismatch` (>250 m + accuracy), `low_resolution` (long edge < 1600 px).
- Originals up to 25 MB. Verifiers and the NGO get resized thumbnails (via `next/image`) plus a "Download original" link (10-minute signed URL).

## Researched, not built yet (in priority order)
1. **Offline capture queue** (PWA + IndexedDB): field sites often have no signal; MaMA, WETSAPP and TreeMapper all sync when connected.
2. **Map with basemap and boundary drawing** (e.g. Leaflet + OpenStreetMap tiles): replaces pasted GeoJSON; walk-the-boundary from GPS points as WRI describes.
3. **Notifications**: email/in-app when a verifier decides or a monitoring report is due.
4. **Guided observation forms**: species picker, threat categories (cutting, erosion, grazing), survival counts per plot.
5. **Auto context**: tide and weather at capture time (WETSAPP does this), useful for interpreting photos and NDVI.
