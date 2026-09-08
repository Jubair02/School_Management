import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel builds Next itself; standalone output is only for self-hosting.
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
