import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo: trace from repo root so ../../fixtures can ship with serverless pages.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/leads": ["./fixtures/*.json"],
    "/leads/[id]": ["./fixtures/*.json"],
  },
};

export default nextConfig;
