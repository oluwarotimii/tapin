import { authorizeRequest, authFailResponse } from "@/server/guard"
import { findMatchingStudent } from "@/server/fingerprintMatch"
import { fingerprintIdentify } from "@/lib/validation"

// Public like /api/v1/taps — the kiosk calls this with no admin session.
// Runs 1:N matching against every enrolled template (src/server/
// fingerprintMatch.ts, nbis-js) and returns which student it belongs to,
// if any.
export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["taps_write"], { allowPublic: true })
  if (!auth.ok) return authFailResponse(auth)
  const parsed = fingerprintIdentify.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const studentId = await findMatchingStudent(parsed.data.image)
  return Response.json(
    studentId ? { matched: true, student_id: studentId } : { matched: false },
  )
}
