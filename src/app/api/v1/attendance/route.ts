import { authorizeRequest, authFailResponse } from "@/server/guard"
import { prisma } from "@/lib/db"
import { getAttendance, toAttendance } from "@/server/attendance"
import { attendancePush } from "@/lib/validation"
import { toMinutes } from "@/lib/types"

function computeDuration(clockIn: string, clockOut: string) {
  const diff = toMinutes(clockOut) - toMinutes(clockIn)
  return diff >= 0 ? diff : toMinutes(clockOut) + 24 * 60 - toMinutes(clockIn)
}

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["attendance_read"])
  if (!auth.ok) return authFailResponse(auth)
  const url = new URL(req.url)
  const date = url.searchParams.get("date")
  const studentId = url.searchParams.get("student_id")
  const records = await getAttendance({ date, studentId })
  return Response.json({ attendance: records })
}

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["attendance_write"])
  if (!auth.ok) return authFailResponse(auth)
  const parsed = attendancePush.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const { student_id, date, clock_in, clock_out, status, override, source } =
    parsed.data

  const student = await prisma.student.findUnique({
    where: { studentId: student_id },
  })
  if (!student)
    return Response.json({ error: "student not found" }, { status: 404 })

  const duration =
    parsed.data.duration_minutes ??
    (clock_out ? computeDuration(clock_in, clock_out) : undefined)

  const rec = await prisma.attendanceRecord.upsert({
    where: { studentId_date: { studentId: student.id, date } },
    create: {
      studentId: student.id,
      date,
      clockIn: clock_in,
      clockOut: clock_out ?? null,
      durationMinutes: duration ?? null,
      status: status ?? (clock_out ? "complete" : "in_progress"),
      override: override ?? false,
      source: source ?? "api",
    },
    update: {
      clockIn: clock_in,
      clockOut: clock_out ?? null,
      durationMinutes: duration ?? null,
      status: status ?? (clock_out ? "complete" : "in_progress"),
      override: override ?? false,
      source: source ?? "api",
    },
    include: { student: { select: { studentId: true, name: true } } },
  })

  return Response.json({ record: toAttendance(rec) }, { status: 201 })
}
