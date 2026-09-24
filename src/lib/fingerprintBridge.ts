"use client"

// Client for fingerprint capture/matching. Two transports:
//
// 1. DigitalPersona's WebSDK (src/lib/digitalPersona.ts) — talks directly
//    to the locally-installed "Digital Persona Lite Client" from the
//    browser for capture, then POSTs the scan to this app's own
//    /api/v1/fingerprint/verify route for a 1:1 match against the one
//    student the caller already picked (nbis-js, runs server-side — see
//    src/server/fingerprintMatch.ts and docs/fingerprint-integration.md).
//    No local bridge process needed for either step. Tried first, since
//    it's the confirmed-working path.
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

async function genericBridgeCapture(): Promise<string | null> {
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

export async function bridgeCapture(): Promise<string | null> {
  const dpSample = await captureDigitalPersonaSample()
  return dpSample ?? genericBridgeCapture()
}

export type VerifyOutcome = "matched" | "no_match" | "not_enrolled" | "capture_failed"

async function postVerify(studentId: string, image: string): Promise<VerifyOutcome> {
  try {
    const res = await fetch("/api/v1/fingerprint/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, image }),
      signal: withTimeout(15000),
    })
    if (!res.ok) return "capture_failed"
    const j = await res.json()
    return j.result === "matched" || j.result === "no_match" || j.result === "not_enrolled"
      ? j.result
      : "capture_failed"
  } catch {
    return "capture_failed"
  }
}

// 1:1 verification: the caller already knows who they're checking (picked
// from a search), so this captures one scan and confirms it against just
// that student's enrolled template — not a 1:N "who is this" search.
export async function verifyFingerprint(studentId: string): Promise<VerifyOutcome> {
  const dpAvailable = await isDigitalPersonaAvailable()
  const sample = dpAvailable
    ? await captureDigitalPersonaSample()
    : await genericBridgeCapture()
  if (!sample) return "capture_failed"
  return postVerify(studentId, sample)
}
