import { db, type TapResult } from "./store"

export type ReaderStatus = "disconnected" | "connecting" | "connected" | "error"

export interface TapEvent {
  id: string
  cardId: string
  result: TapResult
  time: string
}

let status: ReaderStatus = "connected"
let connectTimer: ReturnType<typeof setTimeout> | null = null

const statusListeners = new Set<() => void>()
const tapListeners = new Set<(ev: TapEvent) => void>()

function pad(n: number) {
  return String(n).padStart(2, "0")
}
function nowTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
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

  connect() {
    if (connectTimer) return
    status = "connecting"
    statusListeners.forEach((l) => l())
    connectTimer = setTimeout(() => {
      status = "connected"
      connectTimer = null
      statusListeners.forEach((l) => l())
    }, 800)
  },

  disconnect() {
    if (connectTimer) {
      clearTimeout(connectTimer)
      connectTimer = null
    }
    status = "disconnected"
    statusListeners.forEach((l) => l())
  },

  simulateTap(cardId: string) {
    if (status !== "connected") return
    const result = db.tap(cardId)
    const ev: TapEvent = {
      id: crypto.randomUUID(),
      cardId,
      result,
      time: nowTime(),
    }
    tapListeners.forEach((l) => l(ev))
  },

  writeCard(cardId: string, studentId: string) {
    return delay(600).then(() => db.writeCard(studentId, cardId))
  },

  readCard(cardId: string) {
    return delay(400).then(() => db.readCard(cardId))
  },

  blankCard(cardId: string) {
    return delay(600).then(() => {
      db.blankCard(cardId)
      return true
    })
  },
}
