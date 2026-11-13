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
import type { TapResult } from "./types"

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

// Captures one scan, trying DigitalPersona first and the generic bridge as
// a fallback. Deliberately does NOT pre-check isDigitalPersonaAvailable():
// that call itself enumerates devices, and runCapture enumerates them again,
// so pre-checking cost a redundant IPC round-trip to the Lite Client on
// every single verify. runCapture already returns null fast when no reader
// is attached, so we just attempt it and fall through.
async function captureAny(): Promise<string | null> {
  const dpSample = await captureDigitalPersonaSample()
  if (dpSample) return dpSample
  return genericBridgeCapture()
}

// 1:1 verification only (no attendance write). Kept for external callers and
// API compatibility; the kiosk itself uses verifyAndTapFingerprint below.
export async function verifyFingerprint(studentId: string): Promise<VerifyOutcome> {
  const sample = await captureAny()
  if (!sample) return "capture_failed"
  try {
    const res = await fetch("/api/v1/fingerprint/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, image: sample }),
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

export type VerifyAndTapResult = {
  outcome: VerifyOutcome
  tap: TapResult | null
}

// Capture + verify + clock in/out in ONE server round-trip. This is the
// kiosk's tap-time path: it shaves a full network hop off the old
// verify-then-tap sequence, which matters on the critical path where the
// student is standing at the reader waiting.
export async function verifyAndTapFingerprint(
  studentId: string,
): Promise<VerifyAndTapResult> {
  const sample = await captureAny()
  if (!sample) return { outcome: "capture_failed", tap: null }
  try {
    const res = await fetch("/api/v1/fingerprint/verify-and-tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, image: sample }),
      signal: withTimeout(15000),
    })
    if (!res.ok) return { outcome: "capture_failed", tap: null }
    const j = await res.json()
    const outcome: VerifyOutcome =
      j.result === "matched" || j.result === "no_match" || j.result === "not_enrolled"
        ? j.result
        : "capture_failed"
    return { outcome, tap: (j.tap as TapResult | undefined) ?? null }
  } catch {
    return { outcome: "capture_failed", tap: null }
  }
}
