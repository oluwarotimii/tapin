"use client"

// Client-side wrapper around HID DigitalPersona's WebSDK (window.Fingerprint),
// which talks directly to the locally-installed "Digital Persona Lite
// Client" agent (https://127.0.0.1:52181) — no server-side bridge involved
// in capture. See docs/fingerprint-integration.md §5b for the confirmed API
// this is built against, and public/vendor/digitalpersona/README.md for
// where the vendored SDK files came from.
//
// Captures in Compressed (WSQ) format — the matching engine (nbis-js,
// src/server/fingerprintMatch.ts) only accepts WSQ. WSQ samples arrive
// double-encoded (base64url wrapping a JSON blob wrapping more base64url);
// the unwrap sequence below is copied from the reference app's
// sampleAcquired() handler for the Compressed case, not guessed.

declare global {
  interface Window {
    Fingerprint?: {
      WebApi: new () => DigitalPersonaWebApi
      SampleFormat: { Compressed: number }
      b64UrlTo64: (s: string) => string
      b64UrlToUtf8: (s: string) => string
    }
  }
}

interface DigitalPersonaWebApi {
  onSamplesAcquired: ((e: { samples: string }) => void) | null
  onCommunicationFailed: ((e: unknown) => void) | null
  onDeviceConnected: ((e: unknown) => void) | null
  onDeviceDisconnected: ((e: unknown) => void) | null
  enumerateDevices: () => Promise<string[]>
  startAcquisition: (format: number, readerId: string) => Promise<void>
  stopAcquisition: () => Promise<void>
}

const SCRIPT_URLS = [
  "/vendor/digitalpersona/websdk.client.bundle.min.js",
  "/vendor/digitalpersona/fingerprint.sdk.min.js",
]

let loadPromise: Promise<void> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement("script")
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(el)
  })
}

function ensureSdkLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"))
  if (!loadPromise) {
    loadPromise = SCRIPT_URLS.reduce(
      (p, src) => p.then(() => loadScript(src)),
      Promise.resolve(),
    )
  }
  return loadPromise
}

// A fresh `new Fingerprint.WebApi()` per call was the bug behind "the
// scanner won't wake up again until the page is refreshed": each instance
// opens its own connection handshake with the Lite Client, and abandoned
// ones (e.g. after a capture timeout) were never torn down, leaving the
// device looking busy to the next attempt. One instance, reused for the
// whole page lifetime — matches how the reference app does it.
let sdkInstance: DigitalPersonaWebApi | null = null

async function getSdk(): Promise<DigitalPersonaWebApi | null> {
  await ensureSdkLoaded()
  const Fingerprint = window.Fingerprint
  if (!Fingerprint) return null
  if (!sdkInstance) sdkInstance = new Fingerprint.WebApi()
  return sdkInstance
}

export async function isDigitalPersonaAvailable(): Promise<boolean> {
  try {
    const sdk = await getSdk()
    if (!sdk) return false
    const readers = await sdk.enumerateDevices()
    return Array.isArray(readers) && readers.length > 0
  } catch {
    return false
  }
}

// Matches the 30s "scanning" window shown in the UI (Terminal's scan
// button, FingerprintScan.tsx) — how long we'll wait for a finger.
const CAPTURE_TIMEOUT_MS = 30000

// Unwraps a Compressed (WSQ) sample per the reference app's sampleAcquired():
// samples[0].Data is base64url -> b64UrlTo64 -> base64-decode-to-utf8 ->
// JSON.parse -> .Data is base64url again -> b64UrlTo64 -> actual WSQ bytes.
function unwrapWsqSample(
  Fingerprint: NonNullable<Window["Fingerprint"]>,
  rawSamples: string,
): string {
  const samples = JSON.parse(rawSamples) as { Data: string }[]
  const outer = Fingerprint.b64UrlTo64(samples[0].Data)
  const inner = JSON.parse(Fingerprint.b64UrlToUtf8(outer)) as { Data: string }
  return Fingerprint.b64UrlTo64(inner.Data)
}

// Serializes captures on the shared singleton `sdk` — two overlapping
// startAcquisition calls on one physical device is exactly the kind of
// thing that left it stuck before, so a second call now waits for the
// first to fully finish (including its stopAcquisition) rather than racing it.
let captureLock: Promise<void> = Promise.resolve()

async function runCapture(): Promise<string | null> {
  try {
    const sdk = await getSdk()
    if (!sdk) return null
    const Fingerprint = window.Fingerprint!

    const readers = await sdk.enumerateDevices()
    if (!readers.length) return null

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const finish = async (value: string | null) => {
        if (settled) return
        settled = true
        try {
          await sdk.stopAcquisition()
        } catch {
          // best effort — device may already be stopped
        }
        resolve(value)
      }

      sdk.onSamplesAcquired = (e) => {
        try {
          finish(unwrapWsqSample(Fingerprint, e.samples))
        } catch {
          finish(null)
        }
      }
      sdk.onCommunicationFailed = () => finish(null)

      sdk.startAcquisition(Fingerprint.SampleFormat.Compressed, readers[0]).catch(() => finish(null))

      setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS)
    })
  } catch {
    return null
  }
}

// Starts acquisition, resolves with the first scan as a base64 WSQ string
// (or null on failure/timeout/no reader), then stops acquisition — fully
// awaited before resolving, so the device is guaranteed free for whatever
// calls this next.
export function captureDigitalPersonaSample(): Promise<string | null> {
  const result = captureLock.then(runCapture, runCapture)
  captureLock = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
