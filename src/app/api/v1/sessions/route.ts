import { authorizeRequest, authFailResponse } from "@/server/guard"
import { getActiveSessions } from "@/server/domain"

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["attendance_read"], {
    allowPublic: true,
  })
  if (!auth.ok) return authFailResponse(auth)
  const sessions = await getActiveSessions()
  if (auth.auth.type === "public") {
    // The kiosk only needs to know WHO is currently in, not their card UID.
    return Response.json({
      sessions: sessions.map(({ cardId, ...rest }) => rest),
    })
  }
  return Response.json({ sessions })
}
