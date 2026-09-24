"use client"

// Client-side wrapper around HID DigitalPersona's WebSDK (window.Fingerprint),
// which talks directly to the locally-installed "Digital Persona Lite
// Client" agent (https://127.0.0.1:52181) — no server-side bridge involved
// in capture. See docs/fingerprint-integration.md §5b for the confirmed API
// this is built against, and public/vendor/digitalpersona/README.md for
// where the vendored SDK files came from.
//
// PngImage is the capture format used here (not Raw or Intermediate):
// PngImage decodes with a single Fingerprint.b64UrlTo64() call, while Raw/
// Compressed require an extra JSON-wrapped unwrap step this hasn't been
// tested against real hardware yet, and Intermediate is DigitalPersona's
// own proprietary feature format (not NBIS-compatible, see the doc). A PNG
// is also easy for a future NBIS-based matching bridge to decode with any
// image library.

declare global {
  interface Window {
    Fingerprint?: {
      WebApi: new () => DigitalPersonaWebApi
      SampleFormat: { PngImage: number }
      b64UrlTo64: (s: string) => string
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

export async function isDigitalPersonaAvailable(): Promise<boolean> {
  try {
    await ensureSdkLoaded()
    const Fingerprint = window.Fingerprint
    if (!Fingerprint) return false
    const sdk = new Fingerprint.WebApi()
    const readers = await sdk.enumerateDevices()
    return Array.isArray(readers) && readers.length > 0
  } catch {
    return false
  }
}

const CAPTURE_TIMEOUT_MS = 15000

// Starts acquisition, resolves with the first scan as a base64 PNG string
// (or null on failure/timeout/no reader), then stops acquisition.
export async function captureDigitalPersonaSample(): Promise<string | null> {
  try {
    await ensureSdkLoaded()
    const Fingerprint = window.Fingerprint
    if (!Fingerprint) return null

    const sdk = new Fingerprint.WebApi()
    const readers = await sdk.enumerateDevices()
    if (!readers.length) return null

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        sdk.stopAcquisition().catch(() => {})
        resolve(value)
      }

      sdk.onSamplesAcquired = (e) => {
        try {
          const samples = JSON.parse(e.samples) as string[]
          finish(Fingerprint.b64UrlTo64(samples[0]))
        } catch {
          finish(null)
        }
      }
      sdk.onCommunicationFailed = () => finish(null)

      sdk.startAcquisition(Fingerprint.SampleFormat.PngImage, readers[0]).catch(() => finish(null))

      setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS)
    })
  } catch {
    return null
  }
}
