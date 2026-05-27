import type { NextConfig } from "next";

// NEXT_PUBLIC_BASE_PATH is injected at Docker build time via build args.
// Examples:
//   Deployment under /new:    NEXT_PUBLIC_BASE_PATH=/new
//   Deployment at root:       NEXT_PUBLIC_BASE_PATH=   (empty string)
//
// Both basePath and assetPrefix must be set to the same value so that
// Next.js correctly prefixes all internal navigation and static asset URLs.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactCompiler: true,
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
