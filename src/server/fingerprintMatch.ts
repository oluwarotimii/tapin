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

export type VerifyResult = "matched" | "no_match" | "not_enrolled"

// 1:1 verification: the caller already knows who they claim to be (picked
// from a search, not guessed) — compare the live scan against only that
// student's stored template. O(1) regardless of enrollment size, unlike an
// earlier 1:N "just place your finger" design this replaced: identifying
// against every enrolled template doesn't scale (linear latency growth)
// and gets *less* accurate as the candidate pool grows (more templates
// compared = more chances of a coincidental match past the threshold).
export async function verifyStudentFingerprint(
  externalStudentId: string,
  liveWsqBase64: string,
): Promise<VerifyResult> {
  const student = await prisma.student.findUnique({
    where: { studentId: externalStudentId },
    select: { fingerprintTemplate: { select: { template: true } } },
  })
  if (!student?.fingerprintTemplate) return "not_enrolled"

  const check = await getMatcher()
  const enrolledBase64 = Buffer.from(student.fingerprintTemplate.template).toString(
    "base64",
  )
  // checkDuplicateFingerFromBase64 throws (rather than returning false) on
  // malformed WSQ input — confirmed via a real NBIS decode error, not a
  // crash in our own code. A bad live scan must not 500 the request.
  try {
    return (await check(liveWsqBase64, enrolledBase64)) ? "matched" : "no_match"
  } catch {
    return "no_match"
  }
}
