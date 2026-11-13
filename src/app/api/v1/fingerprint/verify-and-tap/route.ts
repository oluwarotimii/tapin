import { authorizeRequest, authFailResponse } from "@/server/guard"
import { verifyStudentFingerprint, prewarmMatcher } from "@/server/fingerprintMatch"
import { tapByStudentId, logTap } from "@/server/domain"
import { fingerprintVerify } from "@/lib/validation"

prewarmMatcher()

// Public like /api/v1/taps — the kiosk calls this with no admin session.
//
// Verifies a 1:1 fingerprint match AND performs the attendance tap in a
// single request. This replaces the kiosk's old two-call sequence
// (/fingerprint/verify then /taps), removing a full network round-trip from
// the tap-time critical path. The verify step is still O(1): only the one
// student the caller already picked is compared against.
export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["taps_write"], { allowPublic: true })
  if (!auth.ok) return authFailResponse(auth)

  const parsed = fingerprintVerify.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const outcome = await verifyStudentFingerprint(
    parsed.data.student_id,
    parsed.data.image,
  )
  if (outcome !== "matched") return Response.json({ result: outcome })

  const tap = await tapByStudentId(parsed.data.student_id, "fingerprint")
  logTap(parsed.data.student_id, tap, "fingerprint")
  return Response.json({ result: "matched", tap })
}