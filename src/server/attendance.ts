import "server-only"
import { prisma } from "@/lib/db"
import { type AttendanceRecord } from "@/lib/types"

export function toAttendance(r: {
  id: string
  date: string
  clockIn: string
  clockOut: string | null
  durationMinutes: number | null
  status: string
  override: boolean
  source: string
  student: { studentId: string; name: string }
}): AttendanceRecord {
  return {
    id: r.id,
    studentId: r.student.studentId,
    studentName: r.student.name,
    date: r.date,
    clockIn: r.clockIn,
    clockOut: r.clockOut ?? undefined,
    durationMinutes: r.durationMinutes ?? undefined,
    status: r.status as AttendanceRecord["status"],
    override: r.override,
    source: r.source,
  }
}

export async function getAttendance(opts?: {
  date?: string | null
  studentId?: string | null
}): Promise<AttendanceRecord[]> {
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      ...(opts?.date ? { date: opts.date } : {}),
      ...(opts?.studentId
        ? { student: { studentId: opts.studentId } }
        : {}),
    },
    include: { student: { select: { studentId: true, name: true } } },
    orderBy: [{ date: "desc" }, { clockIn: "desc" }],
  })
  return rows.map(toAttendance)
}
