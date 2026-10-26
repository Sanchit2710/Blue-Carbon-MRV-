// Unsplash License: free commercial use, attribution appreciated (we credit in the footer/caption).
// Swap these for the project's own field photography when available.
// Source capped at 2400px wide, quality 85: sharp on large screens without pulling 6000px originals.
const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2400&q=85`;

export const photos = {
  hero: { src: u("1589556183130-530470785fab"), alt: "Mangrove trees standing in still, dark water", credit: "Timothy K", w: 6000, h: 4000 },
  login: { src: u("1764101919176-467e40fd27d5"), alt: "A single mangrove tree on exposed roots in a shallow bay", credit: "Bernd Dittrich", w: 4000, h: 6000 },
  signup: { src: u("1618288389681-f135edea12db"), alt: "A creek winding between mangrove banks under a blue sky", credit: "Muhammadh Saamy", w: 3000, h: 4000 },
  roots: { src: u("1784751449882-c2c28ca2dd78"), alt: "Mangrove prop roots rising from muddy shallows", credit: "Orpita Akther Ratna", w: 6000, h: 4000 },
  underwater: { src: u("1717292741426-d050f4f25503"), alt: "Split view of a mangrove above and below the waterline", credit: "Kristin Hoel", w: 4000, h: 3000 },
  shore: { src: u("1779399642977-7c6bfd7bc472"), alt: "A dense wall of mangroves along a brown estuary", credit: "P Mantha", w: 6000, h: 4000 },
} as const;

// Public cover for a project: its own cover (if hosted on Unsplash, which next/image allows) or an ecosystem photo.
const byEcosystem: Record<string, string> = { mangrove: photos.hero.src, seagrass: photos.underwater.src, salt_marsh: photos.shore.src, other: photos.shore.src };
export const coverFor = (p: { cover_url?: string | null; ecosystem: string }) =>
  p.cover_url?.startsWith("https://images.unsplash.com/") ? p.cover_url : byEcosystem[p.ecosystem] ?? photos.hero.src;
