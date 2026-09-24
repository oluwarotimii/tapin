import "server-only"
import { prisma } from "@/lib/db"

// nbis-js (NIST NBIS mindtct+bozorth3 compiled to WASM, AGPL-3.0-or-later —
// see docs/fingerprint-integration.md for the license tradeoff this was
// adopted under) ships an Emscripten Node fallback that references a bare
// `__dirname`, which native ESM doesn't provide. Its own README claims
// "browser only," but that's this packaging bug, not a real limitation —
// confirmed by running it in plain Node with this polyfill: the WASM loads
// and executes real NBIS code (verified via an authentic NBIS C error
// message on malformed input). Must run before the dynamic import below.
if (typeof (globalThis as Record<string, unknown>).__dirname === "undefined") {
  ;(globalThis as Record<string, unknown>).__dirname = "/"
}

let checkDuplicateFingerFromBase64:
  | ((a: string, b: string) => Promise<boolean>)
  | null = null

async function getMatcher() {
  if (!checkDuplicateFingerFromBase64) {
    const mod = await import("nbis-js")
    checkDuplicateFingerFromBase64 = mod.checkDuplicateFingerFromBase64
  }
  return checkDuplicateFingerFromBase64
}

// 1:N identification: compares the live scan against every enrolled
// template until a match is found. O(n) in student count — fine at
// school scale, would need real optimization far beyond that. Returns the
// external Student.studentId (what tapByStudentId expects), not the
// internal FK stored on FingerprintTemplate.
export async function findMatchingStudent(
  liveWsqBase64: string,
): Promise<string | null> {
  const check = await getMatcher()
  const templates = await prisma.fingerprintTemplate.findMany({
    select: { template: true, student: { select: { studentId: true } } },
  })
  for (const t of templates) {
    const enrolledBase64 = Buffer.from(t.template).toString("base64")
    // checkDuplicateFingerFromBase64 throws (rather than returning false) on
    // malformed WSQ input — confirmed via a real NBIS decode error, not a
    // crash in our own code. One bad template (or a corrupt live scan)
    // must not take down the whole identify request; skip and keep looking.
    try {
      if (await check(liveWsqBase64, enrolledBase64)) return t.student.studentId
    } catch {
      continue
    }
  }
  return null
}
