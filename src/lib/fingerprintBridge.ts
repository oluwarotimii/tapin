"use client"

// Client for fingerprint capture/matching. Two transports:
//
// 1. DigitalPersona's WebSDK (src/lib/digitalPersona.ts) — talks directly
//    to the locally-installed "Digital Persona Lite Client" from the
//    browser, no server-side bridge involved. Tried first for status and
//    capture, since it's the confirmed-working path (docs/fingerprint-
//    integration.md §5b).
// 2. A generic local HTTP bridge (this file's original design, for any
//    other vendor, e.g. Futronic) — no bridge is deployed for that yet, so
//    those calls genuinely report "not connected" until one exists.
//
// Matching (bridgeIdentify) only has transport 2 — DigitalPersona's WebSDK
// is capture-only, confirmed no identify/match call exists in it (§5b) — so
// tap-time auto-identification stays unavailable until a matching bridge
// (NBIS mindtct/bozorth3, §3/§4/§6) is built, regardless of vendor.

import { captureDigitalPersonaSample, isDigitalPersonaAvailable } from "./digitalPersona"

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

// Blocks (server-side, on the bridge) until a finger is presented and
// matched, or times out. Callers loop this while the bridge is connected.
export async function bridgeIdentify(): Promise<string | null> {
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
