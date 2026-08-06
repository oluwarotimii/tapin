import { authorizeRequest, authFailResponse } from "@/server/guard"
import {
  getStudentSchedule,
  setStudentScheduleDay,
  removeStudentScheduleDay,
} from "@/server/students"
import { scheduleDay } from "@/lib/validation"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["schedules_read"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  return Response.json({ schedule: await getStudentSchedule(id) })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["schedules_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  const parsed = scheduleDay.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  const { day, start, end, minimum_minutes } = parsed.data
  await setStudentScheduleDay(id, day, start, end, minimum_minutes)
  return Response.json({ ok: true })
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["schedules_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  const url = new URL(req.url)
  const day = url.searchParams.get("day")
  if (!day) return Response.json({ error: "day query param required" }, { status: 400 })
  await removeStudentScheduleDay(id, day)
  return Response.json({ ok: true })
}
