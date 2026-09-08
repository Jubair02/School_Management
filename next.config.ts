import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel builds Next itself; standalone output is only for self-hosting.
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  // Type errors fail the build. Previously suppressed, which let broken types
  // ship silently — the tree is clean now, so keep the guard on.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
