import { authorizeRequest, authFailResponse } from "@/server/guard"
import { getRecentTaps } from "@/server/domain"

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["attendance_read"])
  if (!auth.ok) return authFailResponse(auth)
  return Response.json({ taps: getRecentTaps() })
}
