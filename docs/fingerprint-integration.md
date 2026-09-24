# Wiring up a real fingerprint scanner (Futronic FS80H or DigitalPersona U.are.U 4500)

Design note for connecting a real fingerprint scanner. Two vendors are under
evaluation — **Futronic FS80H** (no device/SDK yet) and **HID DigitalPersona
U.are.U 4500** (device in hand, "Digital Persona Lite Client" local agent
already installed — see §5b for its confirmed API, verified against a public
reference app). Everything in the web app
(schema, API, admin UI, Terminal kiosk, and the bridge HTTP client) is
already built and wired against this flow regardless of which vendor you end
up with — nothing here is simulated or faked. What's missing is the **bridge
process itself**: a local service that talks to whichever scanner you pick
and answers the HTTP contract this app already calls. This doc covers what
to build once a scanner and its SDK are in hand.

---

## 1. What's already wired up, and what's missing

Real and complete, no app changes needed regardless of which vendor you pick:

- `prisma/schema.prisma` — `FingerprintTemplate { studentId, finger, template, ... }`.
- `POST /api/v1/students/:id/fingerprint` (enroll) and `DELETE .../fingerprint`
  (remove), gated on the `fingerprints_write` scope — `src/server/students.ts`,
  `src/app/api/v1/students/[id]/fingerprint/route.ts`.
- `POST /api/v1/taps` accepting `{ student_id }` as an alternative to
  `{ card_id }` — `src/server/domain.ts`'s `tapByStudentId`, same clock-in/out
  logic as card taps (`tapByCard`).
- `src/lib/fingerprintBridge.ts` — a real `fetch`-based client for the bridge
  contract in §4 (`/status`, `/capture`, `/identify`). It calls a real URL
  (`NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL`, default `http://127.0.0.1:8787`);
  with no bridge listening there, calls correctly fail/report "not connected"
  — this is expected, not a bug, until §5–§6 are built.
- `src/reader.ts#submitFingerprintTap(studentId)` — takes an already-resolved
  student id (from a real bridge `/identify` call) and posts the tap.
  `src/components/Terminal.tsx` already runs a background loop calling
  `bridgeIdentify()` and feeding matches into this.
- `src/components/Fingerprints.tsx`'s enroll flow already calls
  `bridgeCapture()` for a real template and disables itself with an honest
  "bridge not connected" state when there's nothing to talk to.

**Missing**: the bridge process itself (§4) and the vendor capture layer
(§5) — there is no code to build on the app side, only a service to deploy.
None of §1's list changes based on which scanner you pick; only §5/§6 differ.

---

## 2. Choosing between Futronic and DigitalPersona

| | Futronic FS80H | DigitalPersona U.are.U 4500 |
| --- | --- | --- |
| Capture SDK | `ftrScanAPI` — Windows/Linux/Mac/Android, raw image only | HID's "One Touch"/U.are.U SDK — Windows-first |
| Matching | **Not included.** Bring your own (§3) | **Likely included** — their SDK has historically bundled feature extraction + 1:N matching, meaning you may not need §3/§6 at all. Unverified for whatever SDK version you actually get — confirm against their current docs. |
| Linux support | Official — vendor ships a Linux driver + `ftrScanAPI` demo | Not official from HID. Community support exists via `libfprint`/`fprintd` (the open-source Linux fingerprint stack used for OS login) for several U.are.U models, but that's a different, lower-level code path than HID's own proprietary matching SDK — you'd be doing capture-only via libfprint and still need your own matcher (§3), same as the Futronic path. |
| Browser-facing local agent | Not that's documented — you build the bridge yourself (§4) | **Confirmed** — "Digital Persona Lite Client" (`crossmatch.hid.gl/lite-client/`), a local HTTPS service at `127.0.0.1:52181`. The browser talks to it directly via HID's own JS SDK — no custom bridge needed for capture at all. See §5b. |

Net effect, now confirmed for DigitalPersona (verified against a real public
example app, not just docs — see §5b): capture is **meaningfully simpler**
than Futronic — no native binary/FFI, just a `<script>` tag and a JS API
called from React. Matching is **not** bundled in this client SDK though
(§5b), so §3/§6's NBIS pipeline is still needed either way — that part of
the "less custom code" hope didn't pan out.

---

## 3. Two separate concerns: capture vs. matching

A capture-only SDK (confirmed true for Futronic; possibly not true for
DigitalPersona, see §2) only gets you a raw grayscale image from the sensor —
it does not identify a finger against a database of enrolled prints. Matching
is a separate algorithm:

```
finger on sensor ──(vendor capture)──▶ raw image ──mindtct──▶ minutiae ──bozorth3──▶ match score
                                                  (NIST NBIS)          (NIST NBIS)
```

NIST NBIS (public domain, no license cost — the choice made for this project
for any vendor whose SDK doesn't already do matching) ships two relevant
command-line tools:

- `mindtct` — extracts a minutiae template from a raw fingerprint image.
- `bozorth3` — compares two minutiae templates and outputs a match score;
  run it against every enrolled template to do 1:N identification.

`FingerprintTemplate.template` should store whatever the matching step
consumes directly — NBIS's `mindtct` output (`.xyt` minutiae, base64/hex
encoded) if you're on that path, or DigitalPersona's own template format if
its SDK produces one. Either way, store the matcher's input, not the raw
image — smaller, and no re-extraction needed at match time.

**Confirmed for DigitalPersona** (§5b): its browser-facing WebSDK is
capture-only, same as Futronic — no `/identify`-equivalent call exists in
that client library. This section applies to both vendors.

---

## 4. The local companion bridge

**This section applies to Futronic, and to DigitalPersona only for
matching** (not capture — see §5b, its capture path talks directly to the
vendor's own local agent from the browser, no bridge involved). Browsers
cannot call a native vendor library or run `mindtct`/`bozorth3` directly, so
whichever vendor's raw capture you end up with, **matching** needs a small
**local HTTP service** running on the same machine as the scanner:

```
┌ Local bridge (Node, runs on the kiosk machine) ─────────────────────┐
│ GET  /status              → { connected: boolean }                  │
│ POST /capture              → runs vendor capture (+ mindtct if       │
│                               needed), returns a template            │
│ POST /identify              → capture + match (own NBIS pipeline, or │
│                               the vendor SDK's own identify call),   │
│                               returns { studentId, score } or        │
│                               { matched: false }                    │
└───────────────────────────────────────────────────────────────────┘
```

- **Template cache** (only needed if you're running your own NBIS matching,
  i.e. not needed if DigitalPersona's SDK matches internally): the bridge
  periodically fetches all enrolled templates from the server (a new
  admin/API-key-gated `GET` returning `[{ studentId, finger, template }]` —
  not built yet, add when the bridge is built) so `/identify` can run 1:N
  matching locally without a network round-trip per scan.
- **Where it runs**:
  - Electron desktop build: in-process inside `electron/main.js` (it already
    has OS-level access — same pattern as the bundled Postgres/Prisma work),
    exposed on `127.0.0.1:<port>`; the renderer (this same Next.js UI,
    unchanged) calls it via `fetch`.
  - Plain-browser kiosk: a small standalone background service/tray app
    (same bridge code, no Chromium shell) the browser tab's JS calls the
    same way — `fetch('http://127.0.0.1:<port>/...')`. If DigitalPersona
    already ships something like this (§2), this may just be a thin
    pass-through to their local agent instead of a from-scratch service.
- **Already wired**: `Terminal.tsx`'s background loop calls
  `bridgeIdentify()` (→ the bridge's `/identify`), and on a match feeds
  `reader.submitFingerprintTap(studentId)` — no change needed once a bridge
  exists. `Fingerprints.tsx`'s enroll button already calls `bridgeCapture()`
  (→ the bridge's `/capture`) — for higher match quality, have the bridge's
  `/capture` internally take a couple of samples and pick the best, rather
  than changing the app-side call. It then POSTs the returned template to
  the existing `/api/v1/students/:id/fingerprint` endpoint — again, no
  server-side change needed.

---

## 5. Capturing — vendor-specific, not written yet

Not written yet for either vendor — **do this once an SDK is downloaded**,
since writing FFI bindings against an ABI I haven't seen would be guesswork.

### 5a. Futronic ftrScanAPI

`ftrScanAPI` (Windows/Linux DLL-or-.so + headers, downloaded separately from
futronic-tech.com — not redistributed here) only captures a raw image; pair
with §3's NBIS matching. Two realistic implementation approaches, in order
of recommendation:

1. **Small native helper executable.** Futronic's SDK download includes demo
   source (C/C++, typically a C# sample too, and a Linux demo). Adapt their
   demo into a minimal `ftrcapture` binary that opens the device, waits for
   a finger, captures one frame, writes the raw image to stdout or a temp
   file, exits. The Node bridge just `spawn()`s this per capture — avoids
   FFI entirely, keeps ABI-sensitive code in the language the vendor
   actually supports.
2. **FFI binding** (`koffi` or `ffi-napi` from Node) directly against the
   library. More direct, but fragile — you're hand-declaring function
   signatures and struct layouts from the header, and any mismatch is a
   silent crash, not a type error. Only worth it if approach 1 proves
   awkward.

Typical capture flow (verify exact names against your actual `ftrScanAPI.h`
— from public Futronic samples, subject to SDK version and OS drift):
`ftrScanOpenDevice()` → `ftrScanIsFingerPresent()` (poll or blocking wait) →
`ftrScanGetFrame()` / `ftrScanGetImage2()` → `ftrScanCloseDevice()`.

### 5b. DigitalPersona U.are.U 4500 — confirmed, capture is pure client-side JS

Verified by inspecting a public reference app
(`shanxp/fingerprint-digital-persona-u-are-u-4500-web-example` on GitHub —
inspected for API shape, not vendored into this repo). Prerequisite,
already done on the test machine: install **"Digital Persona Lite Client"**
from `crossmatch.hid.gl/lite-client/`. It runs as a local Windows
background service exposing a self-signed HTTPS endpoint at
`https://127.0.0.1:52181/get_connection` — the browser talks to this
directly. **No custom bridge process is needed for capture at all.**

Add HID's own client SDK as plain `<script>` tags (get them from the
reference app or HID's own SDK download — not redistributed in this repo):
`websdk.client.bundle.min.js` (transport/connection handling) and
`fingerprint.sdk.min.js` (the `Fingerprint` namespace). Confirmed API
surface from the reference app:

```js
const sdk = new Fingerprint.WebApi()

sdk.onDeviceConnected = (e) => { /* a reader was plugged in */ }
sdk.onDeviceDisconnected = (e) => { /* unplugged */ }
sdk.onCommunicationFailed = (e) => { /* Lite Client unreachable */ }
sdk.onQualityReported = (e) => { /* Fingerprint.QualityCode[e.quality] per scan */ }
sdk.onSamplesAcquired = (s) => {
  const samples = JSON.parse(s.samples) // array; samples[0] is the capture
}

const readerIds = await sdk.enumerateDevices()        // string[] of reader UIDs
const info = await sdk.getDeviceInfo(readerIds[0])     // { DeviceID, eUidType, eDeviceTech, eDeviceModality }
await sdk.startAcquisition(Fingerprint.SampleFormat.Raw, readerIds[0]) // fires onSamplesAcquired repeatedly
await sdk.stopAcquisition()
```

`Fingerprint.SampleFormat` has four values: `PngImage`, `Raw`, `Compressed`
(WSQ), `Intermediate` (DigitalPersona's own extracted feature set — **not**
NBIS-compatible, don't use it if pairing with `mindtct`/`bozorth3`; use
`Raw` or `PngImage` instead so §3/§6's NBIS pipeline can consume it directly
without needing to understand DigitalPersona's proprietary format). For
non-`PngImage` formats, sample data arrives double-encoded — decode with the
SDK's own `Fingerprint.b64UrlTo64()` then `Fingerprint.b64UrlToUtf8()`
helpers before you get the actual base64 payload (see the reference app's
`sampleAcquired()` for the exact unwrap sequence).

**No identify/match method exists in this client SDK** — confirmed capture
-only, same limitation as Futronic (§3 applies).

**Practical integration point in this repo**: since capture is pure
browser JS talking to a device already running locally, it plugs in at a
different layer than §4's Node bridge. `src/lib/fingerprintBridge.ts`
currently assumes *all* of `/status`/`/capture`/`/identify` are server-side
bridge calls — for DigitalPersona, `/capture`'s implementation would
instead call `Fingerprint.WebApi` directly in the browser (in
`Fingerprints.tsx`/`Terminal.tsx`), then POST the raw sample to a small
local matching-only service (§4) for `/identify`, or straight to
`/api/v1/students/:id/fingerprint` for enroll. This is a real, small
refactor of `fingerprintBridge.ts` to make when you're ready to wire this
up for real — not done yet, since it changes call sites in three files and
is worth doing deliberately rather than as a drive-by.

**Self-signed cert caveat**: because the Lite Client serves HTTPS on
`127.0.0.1` with a self-signed cert, the browser will likely need a one-time
manual trust step (visiting `https://127.0.0.1:52181` directly and accepting
the certificate warning) before `fetch`/XHR calls to it succeed silently —
a known rough edge with HID's WebSDK, confirm current behavior against
whatever Lite Client version you installed.

---

## 6. Running `mindtct` / `bozorth3` from the bridge

Only needed if the vendor SDK doesn't do matching itself (confirmed
necessary for Futronic; check §5b for DigitalPersona). Both are
command-line tools (part of NBIS, build from source or use a prebuilt
distribution for your target OS). The bridge shells out to them the same
way `electron/main.js` shells out to `pg_ctl`/`prisma`:

```
mindtct raw_capture.pgm out_prefix        # writes out_prefix.xyt (minutiae)
bozorth3 out_prefix.xyt enrolled_N.xyt    # prints a match score to stdout
```

Run `bozorth3` against every cached enrolled template, keep the highest
score, and apply a threshold (NBIS's own docs suggest a starting point around
40, but **tune this against your actual scanner and population** — too low
gives false accepts, too high gives false rejects).

---

## 7. Rollout checklist

1. Decide Futronic vs. DigitalPersona (or pilot both) — §2.
2. **DigitalPersona path**: install the Lite Client (already done on the
   test machine), add the two SDK script tags, refactor
   `src/lib/fingerprintBridge.ts`'s capture call to use `Fingerprint.WebApi`
   client-side instead of a server bridge call — §5b. **Futronic path**:
   build the native capture helper — §5a.
3. Either path: build/vendor `mindtct` + `bozorth3` for your target OS, and
   the local matching-only bridge (`/status`, `/identify`, template cache
   sync from the server) — §3, §4, §6.
4. Add the server-side template-listing endpoint the bridge syncs from
   (gated on a read scope, not built yet).
5. Point the bridge at `NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL` (or just run it
   on the default `http://127.0.0.1:8787`) for the matching calls — capture
   calls for DigitalPersona bypass this entirely (§5b).
6. Tune the `bozorth3` match threshold against a real pilot group before
   trusting it for attendance.

---

### Files this touches when you build it

- A new server-side template-listing endpoint (bridge sync source, only if
  doing your own matching) — out-of-repo bridge project reads it.
- `electron/main.js` (if bundling the bridge into the desktop build) — start
  the bridge's HTTP listener alongside the existing Postgres/Next server
  startup sequence.
- Local bridge — **new, out-of-repo** (or a `bridge/` dir): holds the vendor
  capture integration, matching (NBIS or vendor-native), and the template
  cache (if applicable).
