import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Game art is referenced on SteamGridDB's CDN (curated in the backend catalog), never copied here.
    remotePatterns: [{ protocol: "https", hostname: "cdn2.steamgriddb.com", pathname: "/**" }],
    // Art rarely changes and a new catalog link is a new image, so optimized copies are kept 30 days.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // 75 is the default; 60 is for the blurred game page backdrop, which needs less detail.
    qualities: [60, 75],
  },
  experimental: {
    // Static 404 for unmatched URLs; needed because the root layout lives under app/[lang].
    globalNotFound: true,
  },
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
