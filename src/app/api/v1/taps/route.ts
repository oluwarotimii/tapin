import { authorizeRequest, authFailResponse } from "@/server/guard"
import { logTap, tap } from "@/server/domain"
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
        : "tap"

  const result = await tap(parsed.data.card_id, source)
  logTap(parsed.data.card_id, result, source)
  return Response.json({ result })
}
