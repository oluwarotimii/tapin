import { authorizeRequest, authFailResponse } from "@/server/guard"
import { blankCard, writeCard } from "@/server/students"
import { cardBlank, cardWrite } from "@/lib/validation"

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["cards_write"])
  if (!auth.ok) return authFailResponse(auth)
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: "invalid input" }, { status: 400 })

  if (body.blank) {
    const parsed = cardBlank.safeParse(body)
    if (!parsed.success)
      return Response.json({ error: "invalid input" }, { status: 400 })
    await blankCard(parsed.data.card_id)
    return Response.json({ ok: true })
  }

  const parsed = cardWrite.safeParse(body)
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  const ok = await writeCard(parsed.data.student_id, parsed.data.card_id)
  if (!ok)
    return Response.json({ error: "student not found" }, { status: 404 })
  return Response.json({ ok: true })
}
