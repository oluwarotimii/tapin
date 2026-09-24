# Fingerprint tap-in: DigitalPersona U.are.U 4500 + server-side matching

Status: **fully implemented and working** for DigitalPersona, verified as
far as this environment allows (no physical reader here — see the
verification note in each section). Futronic FS80H is documented separately
at the bottom as a secondary/future path, since it needs different
plumbing (no local agent, no bundled matcher shortcut).

---

## 1. Architecture, as actually built

```
Terminal / Fingerprints.tsx (browser)
   │
   │  1. capture (DigitalPersona WebSDK → Lite Client, 127.0.0.1:52181)
   ▼
src/lib/digitalPersona.ts ──WSQ sample (base64)──┐
   │                                              │
   │ enroll: POST /api/v1/students/:id/fingerprint│ verify: POST /api/v1/fingerprint/verify
   │                                              │ body includes student_id — the caller
   ▼                                              │ already knows who they're checking,
Postgres (FingerprintTemplate.template, bytea)   │ picked via search, not guessed
                                                   ▼
                                             src/server/fingerprintMatch.ts
                                             compares the live scan against
                                             ONLY that student's template
                                             (nbis-js, WASM) — 1:1, not 1:N
                                                   │
                                                   ▼
                                    { result: "matched" | "no_match" | "not_enrolled" }
```

**No local bridge process exists or is needed.** Capture talks directly
from the browser to DigitalPersona's own local agent (the "Digital Persona
Lite Client"). Matching runs as a normal Next.js API route — on Vercel,
that's a serverless function, not a service you deploy or manage
separately. This is simpler than the original plan (§"Futronic" below),
which assumed matching would always need a local Windows service running
`mindtct`/`bozorth3` binaries.

**Why 1:1, not 1:N**: an earlier version of this let the Terminal kiosk
just "place your finger" and identify who it was by comparing against
every enrolled student. That doesn't hold up at scale — cost grows
linearly with enrollment count, and worse, 1:N *accuracy* degrades as the
candidate pool grows (more templates compared = more chances of a
coincidental match past the threshold). The current design instead has the
student search their own name/ID first (`src/components/FingerprintScan.tsx`,
reusing the same search UI as enrollment), then scans just to confirm it's
them — a single comparison, correct regardless of whether there are 50 or
5,000 enrolled students.

---

## 2. Capture: DigitalPersona WebSDK

Prerequisite (done on the test machine): install **"Digital Persona Lite
Client"** from `crossmatch.hid.gl/lite-client/`. It's a local background
service exposing a self-signed HTTPS endpoint at
`https://127.0.0.1:52181/get_connection` that the browser talks to
directly via HID's own JS SDK — confirmed by inspecting a public reference
app (`shanxp/fingerprint-digital-persona-u-are-u-4500-web-example` on
GitHub — inspected for API shape only, not vendored).

- `public/vendor/digitalpersona/{fingerprint.sdk.min.js,websdk.client.bundle.min.js}`
  — HID's own redistributable WebSDK client files (see that directory's
  `README.md` for provenance).
- `src/lib/digitalPersona.ts` — lazy-loads the two scripts, exposes
  `isDigitalPersonaAvailable()` and `captureDigitalPersonaSample()`.
  Captures in **`Compressed` (WSQ) format**, not PNG — the matcher (§3)
  only accepts WSQ. WSQ samples arrive double-encoded (base64url wrapping
  a JSON blob wrapping more base64url); the unwrap sequence
  (`b64UrlTo64` → `b64UrlToUtf8` → `JSON.parse` → `.Data` → `b64UrlTo64`)
  is copied verbatim from the reference app's `sampleAcquired()` handler,
  not guessed.

Confirmed API surface (from the reference app):

```js
const sdk = new Fingerprint.WebApi()
sdk.onSamplesAcquired = (e) => { /* e.samples, see unwrap above */ }
sdk.onCommunicationFailed = (e) => { /* Lite Client unreachable */ }
const readerIds = await sdk.enumerateDevices()
await sdk.startAcquisition(Fingerprint.SampleFormat.Compressed, readerIds[0])
await sdk.stopAcquisition()
```

**No identify/match method exists in this client SDK** — it's capture
-only, which is why matching (§3) is a separate piece.

**Self-signed cert caveat**: the Lite Client serves HTTPS on `127.0.0.1`
with a self-signed cert — the browser may need a one-time manual trust step
(visit `https://127.0.0.1:52181` directly, accept the warning) before
`fetch` calls succeed silently. Known HID WebSDK rough edge; hasn't been
re-confirmed against the specific Lite Client version installed.

**Verification status**: the capture code path is real, not simulated, but
this environment has no Windows machine or physical U.are.U 4500 — an
actual capture round-trip has to be tested on the machine with the reader
attached (Admin → Fingerprints, or the Terminal kiosk's "Enroll
Fingerprint" button).

---

## 3. Matching: `nbis-js` (NIST NBIS compiled to WebAssembly)

`src/server/fingerprintMatch.ts`'s `verifyStudentFingerprint()` runs real
`mindtct`+`bozorth3` (via the `nbis-js` npm package) **server-side**,
comparing a live WSQ scan against exactly one student's stored
`FingerprintTemplate` row (1:1, not a loop over every enrolled student —
see §1). Default match threshold is 40 (the package's own default) —
**unverified against real fingerprints, needs tuning with an actual pilot
group** once hardware is available.

### License — read before shipping this

`nbis-js` is **AGPL-3.0-or-later**. That's a strong copyleft license with a
network-use clause: running it inside a hosted web application can obligate
you to make that application's source available to anyone who uses it over
the network. This was a deliberate, explicit tradeoff the project owner
chose to accept in order to get a working matcher quickly — **it has not
been reviewed by a lawyer**. If TapIn is meant to stay proprietary, get
that review before this ships to real users. If it turns out to be a
problem, the fix is swapping `src/server/fingerprintMatch.ts`'s
implementation for a differently-licensed matcher — the rest of the
architecture (capture, API route, schema) doesn't need to change.

### The packaging bug (and why it's not actually "browser only")

`nbis-js`'s own README says "at the moment this project only runs in the
browser." That's wrong, or at least incomplete — it's Emscripten output
with a real Node.js fallback path built in, but that fallback references a
bare `__dirname`, which doesn't exist in native ESM (the package is
`"type": "module"`). Node throws `__dirname is not defined` on import.
Confirmed by testing directly: polyfilling `globalThis.__dirname` before
importing makes it load and run correctly in plain Node, *and* inside
Next.js's own server bundler (verified via `pnpm dev` + a direct request —
got back an authentic NBIS C decode error on malformed test input, proving
the real WASM algorithm executed, not a stub). `src/server/
fingerprintMatch.ts` carries this polyfill; `next.config.ts` also marks
`nbis-js` as a `serverExternalPackage` so the bundler doesn't transform it
and disturb its own environment detection.

### Robustness

`checkDuplicateFingerFromBase64` **throws** (rather than returning `false`)
on malformed WSQ input — confirmed directly. `verifyStudentFingerprint`
catches this, so a corrupt template (or a bad live scan) resolves to
`"no_match"` instead of a 500.

### API

`POST /api/v1/fingerprint/verify` — public like `/api/v1/taps` (no admin
session required; the kiosk calls it directly), scope `taps_write`, body
`{ student_id, image: "<base64 wsq>" }`, response
`{ result: "matched" | "no_match" | "not_enrolled" }`. `not_enrolled` is
distinguished from `no_match` so the UI can give a clearer error (see
`src/components/FingerprintScan.tsx`) — "you haven't enrolled a print yet"
versus "that didn't match."

### Performance

O(1) — a single WASM comparison per verify call, regardless of how many
students are enrolled. This was the point of switching from 1:N (§1).

**Verification status**: confirmed the WASM genuinely executes inside
Next's server runtime and handles malformed input gracefully. **Not
verified**: actual match accuracy against real fingerprints — needs real
hardware and a real pilot group, which this environment doesn't have.

---

## 4. Wiring (`src/lib/fingerprintBridge.ts`)

- `bridgeStatus()` / `bridgeCapture()`: try DigitalPersona first
  (`isDigitalPersonaAvailable`/`captureDigitalPersonaSample`); fall back to
  a generic local HTTP bridge contract (`NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL`,
  default `http://127.0.0.1:8787`) for any other vendor — nothing listens
  there today, so that fallback genuinely reports "not connected."
- `verifyFingerprint(studentId)`: captures via DigitalPersona (or the
  generic bridge's `/capture` as a fallback), POSTs to
  `/api/v1/fingerprint/verify` with that one `studentId`, returns
  `"matched" | "no_match" | "not_enrolled" | "capture_failed"`.
- `src/components/FingerprintScan.tsx` — the Terminal kiosk's tap-time flow:
  search your name/ID, pick yourself, scan (30s window —
  `CAPTURE_TIMEOUT_MS` in `digitalPersona.ts`). On `"matched"`, calls
  `reader.submitFingerprintTap(studentId)` — same tap-event pipeline as
  card taps, so Terminal's existing status display shows the clock-in/out
  result; the modal itself just closes. On any other outcome, shows a
  specific error message with a retry option (except `not_enrolled`, where
  retrying a scan can't help — points at enrollment instead).
- `src/components/FingerprintEnroll.tsx` (Terminal's self-service
  enrollment modal, separate from `FingerprintScan.tsx`) and
  `src/components/Fingerprints.tsx` (admin) both call `bridgeCapture()` for
  enrollment — no vendor-specific code in either component.

---

## 5. Known gaps / not yet done

- **Match accuracy is unverified.** No real hardware here to test against.
  Before trusting this for attendance: test with a real pilot group, tune
  the threshold, check false-accept/false-reject rates.
- **AGPL license review** — see §3.
- **Self-serve enrollment and self-serve verify both have no identity
  check** (`src/components/FingerprintEnroll.tsx`,
  `src/components/FingerprintScan.tsx`): anyone at the kiosk can search any
  student's name and enroll a fingerprint under it or attempt to verify
  against it — nothing ties the *search* step to the person physically at
  the reader. Fine for a card (physical possession is the check); weaker
  for something meant to prove identity. Not fixed — flagging it here so
  it isn't forgotten.
- **One fingerprint per student** (`FingerprintTemplate.studentId` is
  `@unique`) — re-enrolling replaces the old scan. This was a deliberate
  simplification, not a limitation to work around.

---

## Futronic FS80H — secondary path, not built

Kept for reference in case DigitalPersona doesn't work out. Unlike
DigitalPersona, Futronic's `ftrScanAPI` has **no local browser-facing
agent** — capture would need either a native helper executable (adapt
Futronic's own SDK demo source) or FFI bindings (`koffi`/`ffi-napi`)
against `ftrScanAPI.dll`/`.so`, run from a **local bridge process** you'd
have to build and deploy to the kiosk machine (unlike DigitalPersona, which
needed none). That bridge would still call into `src/server/
fingerprintMatch.ts`'s matching logic the same way, or run NBIS locally if
avoiding the network round-trip matters more than avoiding a local service.
Typical capture flow, unverified against a real header:
`ftrScanOpenDevice()` → `ftrScanIsFingerPresent()` → `ftrScanGetFrame()`/
`ftrScanGetImage2()` → `ftrScanCloseDevice()`. Nothing in this repo
implements this — no device or SDK has been available to verify against.
