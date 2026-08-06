import type { TapResult } from "./store"

export interface TapTag {
  label: string
  color: string
  name: string
  headline: string
  sub: string
}

export function tapTag(r: TapResult): TapTag {
  switch (r.kind) {
    case "clocked_in":
      return r.override
        ? {
            label: "IN*",
            color: "#ffb03a",
            name: r.student.name,
            headline: "Clocked in · off-schedule",
            sub: `${r.student.name} · ${r.student.studentId}`,
          }
        : {
            label: "IN",
            color: "#00e5a0",
            name: r.student.name,
            headline: "Clocked in",
            sub: `${r.student.name} · ${r.student.studentId}`,
          }
    case "clocked_out":
      return {
        label: "OUT",
        color: "#4d9fff",
        name: r.student.name,
        headline: `Clocked out · ${r.durationMinutes} min`,
        sub: r.student.name,
      }
    case "too_early":
      return {
        label: "WAIT",
        color: "#ffb03a",
        name: r.student.name,
        headline: `${r.remainingMinutes} min remaining`,
        sub: r.student.name,
      }
    case "already_complete":
      return {
        label: "DONE",
        color: "#56627a",
        name: r.student.name,
        headline: "Session already complete today",
        sub: r.student.name,
      }
    case "not_recognized":
      return {
        label: "ERR",
        color: "#ff4d6a",
        name: "Unknown",
        headline: "Card not recognised",
        sub: "Unknown card",
      }
  }
}

export function hexA(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
