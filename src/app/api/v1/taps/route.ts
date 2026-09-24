import { authorizeRequest, authFailResponse } from "@/server/guard"
import { logTap, tapByCard, tapByStudentId } from "@/server/domain"
import { tapRequest } from "@/lib/validation"

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["taps_write"], {
    allowPublic: true,
  })
  if (!auth.ok) return authFailResponse(auth)
  const parsed = tapRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const source =
    auth.auth.type === "key"
      ? "api_key"
      : auth.auth.type === "session"
        ? "session"
        : parsed.data.student_id
          ? "fingerprint"
          : "tap"

  const identifier = parsed.data.card_id ?? parsed.data.student_id!
  const result = parsed.data.card_id
    ? await tapByCard(parsed.data.card_id, source)
    : await tapByStudentId(parsed.data.student_id!, source)
  logTap(identifier, result, source)
  return Response.json({ result })
}
