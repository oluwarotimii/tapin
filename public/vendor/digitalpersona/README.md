# HID DigitalPersona WebSDK client bundle

`fingerprint.sdk.min.js` + `websdk.client.bundle.min.js` — the client-side
library that talks to the locally-installed "Digital Persona Lite Client"
(`https://127.0.0.1:52181`) from the browser. These are HID's own
redistributable WebSDK files (the point of a WebSDK is to be embedded in
third-party pages), pulled from a public reference implementation
(`shanxp/fingerprint-digital-persona-u-are-u-4500-web-example` on GitHub) on
2026-09-24 since HID's own SDK download wasn't directly available in this
environment. If you obtain the official SDK from HID/Crossmatch directly,
prefer replacing these with that copy.

See `docs/fingerprint-integration.md` §5b for the confirmed API surface and
how `src/lib/digitalPersona.ts` uses it.
