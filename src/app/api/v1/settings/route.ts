import { authorizeRequest, authFailResponse } from "@/server/guard"
import { getAppSettings, setAppSetting } from "@/server/settings"
import { z } from "zod"

const bodySchema = z.object({
  key: z.enum(["cardEnabled", "fingerprintEnabled"]),
  value: z.boolean(),
})

// Public like /api/v1/students, /schedule — the kiosk (Terminal.tsx, no
// admin session) reads this directly via useAppSettings().
export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["students_read"], {
    allowPublic: true,
  })
  if (!auth.ok) return authFailResponse(auth)
  return Response.json(await getAppSettings())
}

export async function PUT(req: Request) {
  const auth = await authorizeRequest(req, ["students_write"])
  if (!auth.ok) return authFailResponse(auth)

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 })
  }

  await setAppSetting(parsed.data.key, parsed.data.value)
  return Response.json({ ok: true })
}