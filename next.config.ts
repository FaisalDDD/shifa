import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) and partial prefetching are disabled: this app is
  // primarily dynamic (per-request auth + database reads), and the cache
  // components model requires Suspense boundaries around uncached data.
  cacheComponents: false,
  partialPrefetching: false,
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
