import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // nbis-js is an Emscripten/WASM package with its own Node-vs-browser
  // environment detection (see src/server/fingerprintMatch.ts) — keep it
  // out of the bundler's transform pipeline so that detection isn't
  // disturbed.
  serverExternalPackages: ["nbis-js"],
}

export default nextConfig
