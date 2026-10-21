import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // nbis-js is an Emscripten/WASM package with its own Node-vs-browser
  // environment detection (see src/server/fingerprintMatch.ts) — keep it
  // out of the bundler's transform pipeline so that detection isn't
  // disturbed.
  serverExternalPackages: ["nbis-js"],
  // Gated behind an env var: standalone output restructures .next in a
  // way that conflicts with Vercel's own file-tracing step during build
  // (see fb61753). Only used by scripts/build-standalone.sh for the
  // cPanel `prod` branch dist.
  ...(process.env.TAPIN_BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // A stray package-lock.json outside this repo (in the home directory)
  // otherwise makes Turbopack guess the wrong monorepo root.
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
