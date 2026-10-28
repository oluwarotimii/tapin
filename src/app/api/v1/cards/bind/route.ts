import { authorizeRequest, authFailResponse } from "@/server/guard"
import { bindNewCard } from "@/server/students"
import { cardWrite } from "@/lib/validation"

// Public — the kiosk's self-enrollment modal calls this when a tap comes
// back unrecognized, so a new student can bind their own card without
// admin involvement. See bindNewCard for why this can't overwrite an
// existing binding (unlike the authenticated /api/v1/cards write path).
export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["cards_write"], { allowPublic: true })
  if (!auth.ok) return authFailResponse(auth)
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: "invalid input" }, { status: 400 })

  const parsed = cardWrite.safeParse(body)
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const result = await bindNewCard(parsed.data.student_id, parsed.data.card_id)
  if (!result.ok)
    return Response.json({ error: result.reason }, { status: 409 })
  return Response.json({ ok: true })
}
