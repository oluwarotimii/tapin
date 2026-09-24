import "server-only"
import { prisma } from "@/lib/db"
import {
  DAYS,
  type CSVImportResult,
  type ScheduleDay,
  type Student,
  type StudentStatus,
} from "@/lib/types"
import { getStudentByInternalId } from "@/server/domain"
import { getAttendance } from "@/server/attendance"

const DAY_INDEX = DAYS.reduce<Record<string, number>>((m, d, i) => {
  m[d] = i
  return m
}, {})

async function toStudentDTO(id: string) {
  return getStudentByInternalId(id)
}

// ── students ────────────────────────────────────────────────────────────────
export async function addStudent(
  name: string,
  studentId: string,
  status: StudentStatus = "active",
) {
  return prisma.student.create({ data: { name, studentId, status } })
}

export async function updateStudent(
  id: string,
  patch: { name?: string; studentId?: string; status?: StudentStatus },
) {
  return prisma.student.update({ where: { id }, data: patch })
}

export async function deleteStudent(id: string) {
  await prisma.activeSession.deleteMany({ where: { studentId: id } })
  await prisma.scheduleDay.deleteMany({ where: { studentId: id } })
  await prisma.attendanceRecord.deleteMany({ where: { studentId: id } })
  await prisma.student.delete({ where: { id } })
}

// ── cards ───────────────────────────────────────────────────────────────────
export async function writeCard(studentId: string, cardId: string) {
  const student = await prisma.student.findUnique({
    where: { studentId },
  })
  if (!student) return false
  await prisma.$transaction(async (tx) => {
    await tx.student.updateMany({
      where: { cardId, id: { not: student.id } },
      data: { cardId: null },
    })
    await tx.student.update({ where: { id: student.id }, data: { cardId } })
  })
  return true
}

export async function blankCard(cardId: string) {
  await prisma.student.updateMany({ where: { cardId }, data: { cardId: null } })
}

export async function readCard(cardId: string) {
  const s = await prisma.student.findUnique({ where: { cardId } })
  return {
    student: s
      ? { id: s.id, studentId: s.studentId, name: s.name }
      : undefined,
    isTapIn: cardId.startsWith("CARD-"),
  }
}

// ── fingerprints ────────────────────────────────────────────────────────────
// `id` here is the internal Student.id, matching the other students/[id]/*
// nested routes (schedule, etc.) — not the external studentId cardWrite uses.
// One fingerprint per student: enrolling again replaces whatever was there.
export async function enrollFingerprint(
  id: string,
  finger: string,
  template: string,
) {
  const student = await prisma.student.findUnique({ where: { id } })
  if (!student) return false
  // template arrives as base64 (JSON can't carry raw binary) — store the
  // decoded bytes (bytea) rather than the base64 text, ~25% smaller.
  const bytes = Buffer.from(template, "base64")
  await prisma.fingerprintTemplate.upsert({
    where: { studentId: id },
    create: { studentId: id, finger, template: bytes },
    update: { finger, template: bytes },
  })
  return true
}

export async function removeFingerprint(id: string) {
  await prisma.fingerprintTemplate.deleteMany({ where: { studentId: id } })
  return true
}

// ── default template schedule ───────────────────────────────────────────────
export async function getDefaultSchedule(): Promise<ScheduleDay[]> {
  const rows = await prisma.scheduleDay.findMany({
    where: { studentId: null },
  })
  return rows.sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day])
}

async function replaceSlot(
  studentId: string | null,
  day: string,
  start: string,
  end: string,
  minimumMinutes: number,
) {
  await prisma.scheduleDay.deleteMany({ where: { studentId, day } })
  await prisma.scheduleDay.create({
    data: { studentId, day, start, end, minimumMinutes },
  })
}

export async function setDefaultScheduleDay(
  day: string,
  start: string,
  end: string,
  minimumMinutes: number,
) {
  await replaceSlot(null, day, start, end, minimumMinutes)
}

export async function removeDefaultScheduleDay(day: string) {
  await prisma.scheduleDay.deleteMany({ where: { studentId: null, day } })
}

export async function getStudentSchedule(id: string) {
  const rows = await prisma.scheduleDay.findMany({ where: { studentId: id } })
  return rows.sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day])
}

export async function setStudentScheduleDay(
  id: string,
  day: string,
  start: string,
  end: string,
  minimumMinutes: number,
) {
  await replaceSlot(id, day, start, end, minimumMinutes)
}

export async function removeStudentScheduleDay(id: string, day: string) {
  await prisma.scheduleDay.deleteMany({ where: { studentId: id, day } })
}

export async function copyDefaultSchedule(id: string) {
  const defaults = await prisma.scheduleDay.findMany({
    where: { studentId: null },
  })
  await prisma.scheduleDay.deleteMany({ where: { studentId: id } })
  await prisma.scheduleDay.createMany({
    data: defaults.map((d) => ({
      studentId: id,
      day: d.day,
      start: d.start,
      end: d.end,
      minimumMinutes: d.minimumMinutes,
    })),
  })
}

export async function hasCustomSchedule(id: string) {
  const n = await prisma.scheduleDay.count({ where: { studentId: id } })
  return n > 0
}

// ── unified CSV import ──────────────────────────────────────────────────────
export async function importUnifiedCSV(
  rows: Record<string, string>[],
): Promise<CSVImportResult> {
  const result: CSVImportResult = { students: 0, slots: 0, defaultSlots: 0 }

  for (const row of rows) {
    const isStudentRow = !!row.name && !!row.student_id
    const status: StudentStatus =
      row.status === "inactive" ? "inactive" : "active"
    let internalId: string | null = null

    if (isStudentRow) {
      const existing = await prisma.student.findUnique({
        where: { studentId: row.student_id },
      })
      if (existing) {
        await prisma.student.update({
          where: { id: existing.id },
          data: { name: row.name, status },
        })
        internalId = existing.id
      } else {
        const created = await prisma.student.create({
          data: { name: row.name, studentId: row.student_id, status },
        })
        internalId = created.id
        result.students++
      }
    }

    if (row.day && row.start && row.end && row.minimum_minutes) {
      const day = row.day.toLowerCase()
      const start = row.start
      const end = row.end
      const minimumMinutes = parseInt(row.minimum_minutes) || 0
      await replaceSlot(
        internalId,
        day,
        start,
        end,
        minimumMinutes,
      )
      if (isStudentRow) result.slots++
      else result.defaultSlots++
    }
  }

  return result
}

// ── attendance CSV export ───────────────────────────────────────────────────
export async function exportAttendanceCSV() {
  const attendance = await getAttendance()
  const header =
    "date,student_id,name,clock_in,clock_out,duration_minutes,status,override,source"
  const rows = attendance
    .filter((r) => r.status !== "in_progress")
    .map(
      (r) =>
        `${r.date},${r.studentId},${r.studentName},${r.clockIn},${r.clockOut ?? ""},${r.durationMinutes ?? ""},${r.status},${r.override ? "yes" : ""},${r.source}`,
    )
  return [header, ...rows].join("\n")
}

export async function upsertStudentDTOs(
  create: { name: string; studentId: string; status?: StudentStatus }[],
  update: { id: string; name?: string; studentId?: string; status?: StudentStatus }[],
): Promise<Student[]> {
  for (const c of create) {
    await prisma.student.create({ data: c })
  }
  for (const u of update) {
    await prisma.student.update({ where: { id: u.id }, data: u })
  }
  const rows = await prisma.student.findMany({
    include: { schedule: true, session: true },
    orderBy: { studentId: "asc" },
  })
  return rows.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    status: s.status as StudentStatus,
    cardId: s.cardId,
    schedule: s.schedule,
  }))
}
