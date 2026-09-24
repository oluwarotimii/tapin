import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  DAYS,
  dateStr,
  pad,
  timeStr,
  toMinutes,
  type ActiveSession,
  type ScheduleDay,
  type Student,
  type TapEvent,
  type TapResult,
} from "@/lib/types"

// ── serializers ──────────────────────────────────────────────────────────────
interface StudentWithSchedule {
  id: string
  studentId: string
  name: string
  status: string
  cardId: string | null
  schedule: ScheduleDay[]
  session?: { id: string; cardId: string | null; clockedInAt: Date } | null
  fingerprintTemplate?: { id: string } | null
}

function toStudent(s: StudentWithSchedule): Student {
  return {
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    status: s.status as Student["status"],
    cardId: s.cardId,
    schedule: s.schedule.map((d) => ({
      id: d.id,
      day: d.day,
      start: d.start,
      end: d.end,
      minimumMinutes: d.minimumMinutes,
    })),
    fingerprintCount: s.fingerprintTemplate ? 1 : 0,
  }
}

// ── queries ──────────────────────────────────────────────────────────────────
export async function getStudents(): Promise<Student[]> {
  const rows = await prisma.student.findMany({
    include: {
      schedule: true,
      session: true,
      fingerprintTemplate: { select: { id: true } },
    },
    orderBy: { studentId: "asc" },
  })
  return rows.map(toStudent)
}

export async function getStudentByInternalId(id: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      schedule: true,
      session: true,
      fingerprintTemplate: { select: { id: true } },
    },
  })
  return s ? toStudent(s) : null
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const rows = await prisma.activeSession.findMany({
    include: { student: { select: { id: true, name: true } } },
  })
  return rows.map((s) => ({
    studentId: s.studentId,
    cardId: s.cardId,
    clockedInAt: s.clockedInAt.toISOString(),
    studentName: s.student.name,
  }))
}

export function nowTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ── live tap feed (in-process) ───────────────────────────────────────────────
const recentTaps: TapEvent[] = []
const MAX_TAPS = 60

export function logTap(cardId: string, result: TapResult, source: string) {
  recentTaps.unshift({
    id: crypto.randomUUID(),
    cardId,
    result,
    time: nowTime(),
    source,
  })
  if (recentTaps.length > MAX_TAPS) recentTaps.pop()
}

export function getRecentTaps(): TapEvent[] {
  return recentTaps
}

// ── tap logic ────────────────────────────────────────────────────────────────
async function effectiveSchedule(
  tx: Prisma.TransactionClient,
  student: StudentWithSchedule,
): Promise<ScheduleDay[]> {
  if (student.schedule.length) return student.schedule
  const defaults = await tx.scheduleDay.findMany({
    where: { studentId: null },
  })
  return defaults
}

export async function tapByCard(cardId: string, source = "tap"): Promise<TapResult> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { cardId },
      include: { schedule: true, session: true },
    })
    return performTap(tx, student, cardId, source)
  })
}

export async function tapByStudentId(
  studentId: string,
  source = "tap",
): Promise<TapResult> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { studentId },
      include: { schedule: true, session: true },
    })
    return performTap(tx, student, null, source)
  })
}

type TappableStudent = StudentWithSchedule & {
  session: { id: string; clockedInAt: Date } | null
}

async function performTap(
  tx: Prisma.TransactionClient,
  student: TappableStudent | null,
  cardId: string | null,
  source: string,
): Promise<TapResult> {
  const now = new Date()
  const today = DAYS[now.getDay()]

  if (!student || student.status !== "active") {
    const r: TapResult = { kind: "not_recognized" }
    return r
  }

  const sched = await effectiveSchedule(tx, student)
  const slot = sched.find((d) => d.day === today)
  const session = student.session

  // ── already clocked in → try to clock out ───────────────────────────────
  if (session) {
    const elapsed = Math.floor(
      (now.getTime() - session.clockedInAt.getTime()) / 60000,
    )
    const required = slot?.minimumMinutes ?? 0

    if (elapsed < required) {
      return {
        kind: "too_early",
        student: toStudent(student),
        remainingMinutes: required - elapsed,
      } as TapResult
    }

    await tx.activeSession.delete({ where: { id: session.id } })
    const rec = await tx.attendanceRecord.findFirst({
      where: {
        studentId: student.id,
        date: dateStr(now),
        status: "in_progress",
      },
    })
    if (rec) {
      await tx.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          clockOut: timeStr(now),
          durationMinutes: elapsed,
          status: elapsed >= required ? "complete" : "incomplete",
        },
      })
    }
    return {
      kind: "clocked_out",
      student: toStudent(student),
      durationMinutes: elapsed,
    } as TapResult
  }

  // ── not clocked in → clock in ────────────────────────────────────────────
  const done = await tx.attendanceRecord.findFirst({
    where: { studentId: student.id, date: dateStr(now) },
  })
  if (done && done.status !== "in_progress") {
    return { kind: "already_complete", student: toStudent(student) } as TapResult
  }

  const nowM = now.getHours() * 60 + now.getMinutes()
  const inWindow =
    !!slot && nowM >= toMinutes(slot.start) && nowM < toMinutes(slot.end)

  await tx.activeSession.create({
    data: { studentId: student.id, cardId, clockedInAt: now },
  })
  await tx.attendanceRecord.create({
    data: {
      studentId: student.id,
      date: dateStr(now),
      clockIn: timeStr(now),
      status: "in_progress",
      override: !inWindow,
      source,
    },
  })
  return {
    kind: "clocked_in",
    student: toStudent(student),
    override: inWindow ? undefined : true,
  } as TapResult
}
