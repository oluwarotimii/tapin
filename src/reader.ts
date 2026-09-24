import { db, type TapResult } from "./store"

export type ReaderStatus = "disconnected" | "connecting" | "connected" | "error"

export interface TapEvent {
  id: string
  cardId: string
  result: TapResult
  time: string
}

let status: ReaderStatus = "connected"

const statusListeners = new Set<() => void>()
const tapListeners = new Set<(ev: TapEvent) => void>()

function pad(n: number) {
  return String(n).padStart(2, "0")
}
function nowTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const reader = {
  getStatus: () => status,

  subscribeStatus(listener: () => void) {
    statusListeners.add(listener)
    return () => {
      statusListeners.delete(listener)
    }
  },

  subscribeTaps(listener: (ev: TapEvent) => void) {
    tapListeners.add(listener)
    return () => {
      tapListeners.delete(listener)
    }
  },

  // Manual kiosk online/offline toggle — arms/disarms the hidden HID capture
  // input (see useHidCapture.ts). There is no real "device present" signal
  // for a keyboard-wedge reader, so this is a deliberate operator switch,
  // not a simulated hardware handshake.
  connect() {
    status = "connected"
    statusListeners.forEach((l) => l())
  },

  disconnect() {
    status = "disconnected"
    statusListeners.forEach((l) => l())
  },

  // Called for every real card read — either physical HID keystrokes
  // (useHidCapture.ts) or an admin-triggered card assignment test. Posts a
  // real tap to POST /api/v1/taps.
  async submitCardTap(cardId: string) {
    if (status !== "connected") return
    const result = await db.tapCard(cardId)
    const ev: TapEvent = {
      id: crypto.randomUUID(),
      cardId,
      result,
      time: nowTime(),
    }
    tapListeners.forEach((l) => l(ev))
  },

  // Called once the local fingerprint bridge (docs/fingerprint-integration.md)
  // has resolved a scan to a student. Feeds the same tap-event stream as
  // submitCardTap so the UI needs no separate rendering path.
  async submitFingerprintTap(studentId: string) {
    if (status !== "connected") return
    const result = await db.tapFingerprint(studentId)
    const ev: TapEvent = {
      id: crypto.randomUUID(),
      cardId: studentId,
      result,
      time: nowTime(),
    }
    tapListeners.forEach((l) => l(ev))
  },

  writeCard(cardId: string, studentId: string) {
    return db.writeCard(studentId, cardId)
  },

  readCard(cardId: string) {
    return db.readCard(cardId)
  },

  blankCard(cardId: string) {
    return db.blankCard(cardId)
  },
}
