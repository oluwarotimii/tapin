import { authorizeRequest, authFailResponse } from "@/server/guard"
import { verifyStudentFingerprint } from "@/server/fingerprintMatch"
import { fingerprintVerify } from "@/lib/validation"

// Public like /api/v1/taps — the kiosk calls this with no admin session.
// 1:1 verification: the caller already picked who they claim to be (via
// search, not guessed), we just confirm the scan matches that one
// student's enrolled template. See src/server/fingerprintMatch.ts for why
// this replaced an earlier 1:N "just place your finger" design.
export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["taps_write"], { allowPublic: true })
  if (!auth.ok) return authFailResponse(auth)
  const parsed = fingerprintVerify.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const result = await verifyStudentFingerprint(parsed.data.student_id, parsed.data.image)
  return Response.json({ result })
}
