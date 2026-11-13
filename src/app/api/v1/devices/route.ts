import { authorizeRequest, authFailResponse } from "@/server/guard"
import { getDevices, getRecentPunches } from "@/server/adms"

// Admin-only: list registered ADMS devices and the most recent punches they
// pushed. The /iclock/* endpoints themselves are unauthenticated (device
// protocol); this is the read side for the dashboard.
export async function GET(req: Request) {
  const auth = await authorizeRequest(req, [])
  if (!auth.ok) return authFailResponse(auth)

  const [devices, punches] = await Promise.all([
    getDevices(),
    getRecentPunches(50),
  ])
  return Response.json({ devices, punches })
}