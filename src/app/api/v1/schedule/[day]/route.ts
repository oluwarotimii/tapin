import { authorizeRequest, authFailResponse } from "@/server/guard"
import { removeDefaultScheduleDay } from "@/server/students"

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ day: string }> },
) {
  const auth = await authorizeRequest(req, ["schedules_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { day } = await ctx.params
  await removeDefaultScheduleDay(day)
  return Response.json({ ok: true })
}
