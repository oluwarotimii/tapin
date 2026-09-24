"use client"

// Client for fingerprint capture/matching. Two transports:
//
// 1. DigitalPersona's WebSDK (src/lib/digitalPersona.ts) — talks directly
//    to the locally-installed "Digital Persona Lite Client" from the
//    browser for capture, then POSTs the scan to this app's own
//    /api/v1/fingerprint/identify route for matching (nbis-js, runs
//    server-side — see src/server/fingerprintMatch.ts and
//    docs/fingerprint-integration.md). No local bridge process needed for
//    either step. Tried first, since it's the confirmed-working path.
// 2. A generic local HTTP bridge (this file's original design, for any
//    other vendor, e.g. Futronic) — no bridge is deployed for that yet, so
//    those calls genuinely report "not connected" until one exists.

import {
  captureDigitalPersonaSample,
  isDigitalPersonaAvailable,
} from "./digitalPersona"

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL ?? "http://127.0.0.1:8787"

function withTimeout(ms: number) {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

async function genericBridgeStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, { signal: withTimeout(1500) })
    if (!res.ok) return false
    const j = await res.json()
    return !!j.connected
  } catch {
    return false
  }
}

export async function bridgeStatus(): Promise<boolean> {
  if (await isDigitalPersonaAvailable()) return true
  return genericBridgeStatus()
}

export async function bridgeCapture(): Promise<string | null> {
  const dpSample = await captureDigitalPersonaSample()
  if (dpSample) return dpSample

  try {
    const res = await fetch(`${BRIDGE_URL}/capture`, {
      method: "POST",
      signal: withTimeout(15000),
    })
    if (!res.ok) return null
    const j = await res.json()
    return typeof j.template === "string" ? j.template : null
  } catch {
    return null
  }
}

// Blocks until a finger is presented (DigitalPersona's startAcquisition) or
// times out, then asks the server to match it against every enrolled
// template. Callers loop this while the bridge is connected.
export async function bridgeIdentify(): Promise<string | null> {
  if (await isDigitalPersonaAvailable()) {
    const sample = await captureDigitalPersonaSample()
    if (!sample) return null
    try {
      const res = await fetch("/api/v1/fingerprint/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sample }),
        signal: withTimeout(15000),
      })
      if (!res.ok) return null
      const j = await res.json()
      return j.matched && typeof j.student_id === "string" ? j.student_id : null
    } catch {
      return null
    }
  }

  try {
    const res = await fetch(`${BRIDGE_URL}/identify`, {
      method: "POST",
      signal: withTimeout(30000),
    })
    if (!res.ok) return null
    const j = await res.json()
    return j.matched && typeof j.studentId === "string" ? j.studentId : null
  } catch {
    return null
  }
}
