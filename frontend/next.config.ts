import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone carrying only the modules actually imported, so the
  // container ships a fraction of the dependency tree.
  output: "standalone",
  // The image builds this directory on its own; without this Next tries to
  // infer a workspace root from parent lockfiles and warns.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
