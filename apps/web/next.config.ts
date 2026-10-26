import type { NextConfig } from "next";

// Private evidence thumbnails are resized through next/image from short-lived signed URLs.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Full-resolution phone photos: 25 MB cap enforced in the action, plus multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" },
      // signed URLs carry ?token=…, so search is left open for this path only
      ...(supabase ? [{ protocol: "https" as const, hostname: new URL(supabase).hostname, pathname: "/storage/v1/object/sign/evidence/**" }] : []),
    ],
    qualities: [75, 85],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
