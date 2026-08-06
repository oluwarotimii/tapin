import { authorizeRequest, authFailResponse } from "@/server/guard"
import {
  getDefaultSchedule,
  setDefaultScheduleDay,
} from "@/server/students"
import { scheduleDay } from "@/lib/validation"

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["schedules_read"], {
    allowPublic: true,
  })
  if (!auth.ok) return authFailResponse(auth)
  return Response.json({ schedule: await getDefaultSchedule() })
}

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["schedules_write"])
  if (!auth.ok) return authFailResponse(auth)
  const parsed = scheduleDay.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  const { day, start, end, minimum_minutes } = parsed.data
  await setDefaultScheduleDay(day, start, end, minimum_minutes)
  return Response.json({ ok: true })
}
