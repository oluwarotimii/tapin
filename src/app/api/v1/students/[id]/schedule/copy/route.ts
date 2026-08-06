import { authorizeRequest, authFailResponse } from "@/server/guard"
import { copyDefaultSchedule } from "@/server/students"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["schedules_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  try {
    await copyDefaultSchedule(id)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "student not found" }, { status: 404 })
  }
}
