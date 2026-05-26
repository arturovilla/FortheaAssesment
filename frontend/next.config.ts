import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles every file the runtime needs into
  // `.next/standalone/`, letting the production Docker image ship just the
  // server + its real dependencies (~150 MB) instead of copying the whole
  // repo + node_modules. The runner stage in Dockerfile copies from here.
  output: "standalone",
};

export default nextConfig;
