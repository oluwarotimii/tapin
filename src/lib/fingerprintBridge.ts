"use client"

// Real client for the local fingerprint companion bridge described in
// docs/fingerprint-integration.md. No hardware/bridge exists yet, so every
// call below will genuinely fail with "not connected" until one is deployed
// — nothing here fabricates a result. The moment a real bridge is running
// on the kiosk machine, this starts working with zero app-code changes.

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL ?? "http://127.0.0.1:8787"

function withTimeout(ms: number) {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

export async function bridgeStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, { signal: withTimeout(1500) })
    if (!res.ok) return false
    const j = await res.json()
    return !!j.connected
  } catch {
    return false
  }
}

export async function bridgeCapture(): Promise<string | null> {
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
