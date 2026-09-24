# Wiring up a real fingerprint scanner (Futronic FS80H)

Design note for connecting a real Futronic FS80H USB scanner. Everything in
the web app (schema, API, admin UI, Terminal kiosk, and the bridge HTTP
client) is already built and wired against this flow — nothing here is
simulated or faked. What's missing is the **bridge process itself**: a local
service that talks to the scanner and answers the HTTP contract this app
already calls. This doc covers what to build once the scanner and its SDK
are in hand.

---

## 1. What's already wired up, and what's missing

Real and complete, no app changes needed when hardware arrives:

- `prisma/schema.prisma` — `FingerprintTemplate { studentId, finger, template, ... }`.
- `POST /api/v1/students/:id/fingerprint` (enroll) and `DELETE .../fingerprint`
  (remove), gated on the `fingerprints_write` scope — `src/server/students.ts`,
  `src/app/api/v1/students/[id]/fingerprint/route.ts`.
- `POST /api/v1/taps` accepting `{ student_id }` as an alternative to
  `{ card_id }` — `src/server/domain.ts`'s `tapByStudentId`, same clock-in/out
  logic as card taps (`tapByCard`).
- `src/lib/fingerprintBridge.ts` — a real `fetch`-based client for the bridge
  contract in §3 (`/status`, `/capture`, `/identify`). It calls a real URL
  (`NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL`, default `http://127.0.0.1:8787`);
  with no bridge listening there, calls correctly fail/report "not connected"
  — this is expected, not a bug, until §4–§5 are built.
- `src/reader.ts#submitFingerprintTap(studentId)` — takes an already-resolved
  student id (from a real bridge `/identify` call) and posts the tap.
  `src/components/Terminal.tsx` already runs a background loop calling
  `bridgeIdentify()` and feeding matches into this.
- `src/components/Fingerprints.tsx`'s enroll flow already calls
  `bridgeCapture()` for a real template and disables itself with an honest
  "bridge not connected" state when there's nothing to talk to.

**Missing**: the bridge process itself (§3) and the ftrScanAPI capture layer
(§4) — there is no code to build on the app side, only a service to deploy.

---

## 2. Two separate concerns: capture vs. matching

Futronic's `ftrScanAPI` (Windows DLL + headers, downloaded separately from
futronic-tech.com — not redistributed here) **only captures a raw grayscale
image** from the sensor. It does not identify a finger against a database of
enrolled prints. Matching is a separate algorithm:

```
finger on sensor ──ftrScanAPI──▶ raw image ──mindtct──▶ minutiae ──bozorth3──▶ match score
                    (capture)              (NIST NBIS)          (NIST NBIS)
```

NIST NBIS (public domain, no license cost — the choice made for this project)
ships two relevant command-line tools:

- `mindtct` — extracts a minutiae template from a raw fingerprint image.
- `bozorth3` — compares two minutiae templates and outputs a match score;
  run it against every enrolled template to do 1:N identification.

`FingerprintTemplate.template` should store the `mindtct` output (its `.xyt`
minutiae file, base64- or hex-encoded as a string), not the raw image —
smaller, and it's what `bozorth3` consumes directly.

---

## 3. The local companion bridge (required either way)

Browsers cannot call a Windows DLL. Whether TapIn is accessed through the
Electron desktop build (see `electron/main.js` and `AGENTS.md`'s "Windows
desktop build" section) or through a plain browser tab pointed at a hosted
kiosk, fingerprint capture needs a small **local HTTP service** running on
the same Windows machine as the scanner:

```
┌ Local bridge (Node, runs on the kiosk machine) ─────────────────────┐
│ GET  /status              → { connected: boolean }                  │
│ POST /capture              → runs ftrScanAPI capture + mindtct,      │
│                               returns a minutiae template            │
│ POST /identify              → capture + mindtct, then bozorth3       │
│                               against a locally cached template set, │
│                               returns { studentId, score } or        │
│                               { matched: false }                    │
└───────────────────────────────────────────────────────────────────┘
```

- **Template cache**: the bridge periodically fetches all enrolled templates
  from the server (a new admin/API-key-gated `GET` returning
  `[{ studentId, finger, template }]` — not built yet, add when the bridge
  is built) so `/identify` can run 1:N matching locally without a network
  round-trip per scan, and works even if the network briefly drops.
- **Where it runs**:
  - Electron desktop build: in-process inside `electron/main.js` (it already
    has OS-level access — same pattern as the bundled Postgres/Prisma work),
    exposed on `127.0.0.1:<port>`; the renderer (this same Next.js UI,
    unchanged) calls it via `fetch`.
  - Plain-browser kiosk: a small standalone background service/tray app
    (same bridge code, no Chromium shell) the browser tab's JS calls the
    same way — `fetch('http://127.0.0.1:<port>/...')`.
- **Already wired**: `Terminal.tsx`'s background loop calls
  `bridgeIdentify()` (→ the bridge's `/identify`), and on a match feeds
  `reader.submitFingerprintTap(studentId)` — no change needed once a bridge
  exists. `Fingerprints.tsx`'s enroll button already calls `bridgeCapture()`
  (→ the bridge's `/capture`) — for higher match quality, have the bridge's
  `/capture` internally take a couple of samples and pick the best, rather
  than changing the app-side call. It then POSTs the returned
  template to the existing `/api/v1/students/:id/fingerprint` endpoint —
  again, no server-side change needed.

---

## 4. Capturing with ftrScanAPI

Not written yet — **do this once the SDK is downloaded**, since writing FFI
bindings against an ABI I haven't seen would be guesswork. Two realistic
approaches, in order of recommendation:

1. **Small native helper executable.** Futronic's SDK download includes demo
   source (C/C++, and typically a C# sample too). Adapt their demo into a
   minimal `ftrcapture.exe` that opens the device, waits for a finger,
   captures one frame, writes the raw image to stdout or a temp file, exits.
   The Node bridge just `spawn()`s this executable per capture. This avoids
   FFI entirely and keeps the ABI-sensitive code in the language (C/C++) the
   vendor actually supports.
2. **FFI binding** (`koffi` or `ffi-napi` from Node) directly against
   `ftrScanAPI.dll`. More direct, but fragile — you're hand-declaring the
   DLL's function signatures and struct layouts from the header, and any
   mismatch is a silent crash, not a type error. Only worth it if approach 1
   proves awkward.

Typical `ftrScanAPI` capture flow (verify exact names against your actual
`ftrScanAPI.h` — from public Futronic samples, subject to SDK version drift):
`ftrScanOpenDevice()` → `ftrScanIsFingerPresent()` (poll or blocking wait) →
`ftrScanGetFrame()` / `ftrScanGetImage2()` → `ftrScanCloseDevice()`.

**Action item before writing this code:** confirm the FS80H's Windows driver
version you're shipping against, and pull the exact function signatures from
the SDK's own header — don't trust the paragraph above as gospel.

---

## 5. Running `mindtct` / `bozorth3` from the bridge

Both are command-line tools (part of NBIS, build from source or use a
prebuilt Windows distribution). The bridge shells out to them the same way
`electron/main.js` shells out to `pg_ctl`/`prisma`:

```
mindtct raw_capture.pgm out_prefix        # writes out_prefix.xyt (minutiae)
bozorth3 out_prefix.xyt enrolled_N.xyt    # prints a match score to stdout
```

Run `bozorth3` against every cached enrolled template, keep the highest
score, and apply a threshold (NBIS's own docs suggest a starting point around
40, but **tune this against your actual scanner and population** — too low
gives false accepts, too high gives false rejects).

---

## 6. Rollout checklist

1. Confirm the FS80H's driver/SDK download and exact `ftrScanAPI` function
   set for your shipped driver version. — §4
2. Build the capture helper (native `.exe` or FFI) and confirm it can pull a
   raw image reliably (`ftrScanAPI` demo app is the fastest way to sanity
   check the hardware before writing any bridge code).
3. Build/vendor `mindtct` + `bozorth3` for Windows.
4. Build the local bridge (`/status`, `/capture`, `/identify`, template
   cache sync from the server). — §3
5. Add the server-side template-listing endpoint the bridge syncs from
   (gated on a read scope, not built yet).
6. Point the bridge at `NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL` (or just run it on
   the default `http://127.0.0.1:8787`) — the app side needs no changes.
7. Tune the `bozorth3` match threshold against a real pilot group before
   trusting it for attendance.

---

### Files this touches when you build it

- A new server-side template-listing endpoint (bridge sync source) —
  out-of-repo bridge project reads it.
- `electron/main.js` (if bundling the bridge into the desktop build) — start
  the bridge's HTTP listener alongside the existing Postgres/Next server
  startup sequence.
- Local bridge — **new, out-of-repo** (or a `bridge/` dir): holds the
  `ftrScanAPI` integration, NBIS invocations, and the template cache.
