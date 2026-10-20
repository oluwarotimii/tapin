"use client"

// Client for the "NSCCN / wCopy Smart Reader" (VID 0x0416, PID 0xb030) —
// an undocumented USB HID RFID/NFC dongle. Its wire protocol was
// reverse-engineered (Ghidra decompilation of the vendor's nfcPro_x64.exe,
// cross-checked against a real API Monitor capture of its actual traffic —
// see wcopy-bridge/protocol.js for the full derivation). The reader's chip
// turned out to be PN532-compatible, so once past the vendor's USB framing,
// card detection is the standard, documented PN532 InListPassiveTarget
// command.
//
// Same shape as fingerprintBridge.ts: a local companion process
// (wcopy-bridge/) does the actual USB HID talking (needs native node-hid,
// which can't run in a browser or in Next.js's server runtime), exposed
// over local HTTP for this kiosk tab to poll.
//
// We only use the card's UID, not page data — it's fixed per card and
// sufficient as a student identifier, so there's no reason to chase the
// (still-unconfirmed) page-read response format.

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_WCOPY_BRIDGE_URL ?? "http://127.0.0.1:8788"

function withTimeout(ms: number) {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

export async function wcopyBridgeStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, { signal: withTimeout(1500) })
    if (!res.ok) return false
    const j = await res.json()
    return !!j.connected
  } catch {
    return false
  }
}

export type DetectResult =
  | { found: true; uid: string; atqa: string; sak: string }
  | { found: false }
  | null // bridge unreachable or reader not responding

export async function detectCard(): Promise<DetectResult> {
  try {
    const res = await fetch(`${BRIDGE_URL}/detect-card`, {
      method: "POST",
      signal: withTimeout(3000),
    })
    if (!res.ok) return null
    const j = await res.json()
    if (!j.ok) return null
    return j.found ? { found: true, uid: j.uid, atqa: j.atqa, sak: j.sak } : { found: false }
  } catch {
    return null
  }
}
