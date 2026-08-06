export type StudentStatus = "active" | "inactive"

export interface Student {
  id: string
  name: string
  studentId: string
  status: StudentStatus
  cardId?: string
  schedule?: ScheduleDay[]
}

export interface ScheduleDay {
  day: string
  start: string // "HH:MM"
  end: string // "HH:MM" — tap-in window closes here
  minimumMinutes: number // class duration — student must stay at least this long
}

export interface CSVImportResult {
  students: number
  slots: number
  defaultSlots: number
}

export type AttendanceStatus = "complete" | "incomplete" | "in_progress"

export interface AttendanceRecord {
  id: string
  studentId: string
  studentName: string
  date: string
  clockIn: string
  clockOut?: string
  durationMinutes?: number
  status: AttendanceStatus
  override?: boolean
}

export interface ActiveSession {
  studentId: string // Student.id (internal)
  cardId: string
  clockedInAt: Date
}

export type TapResult =
  | { kind: "clocked_in"; student: Student; override?: boolean }
  | { kind: "clocked_out"; student: Student; durationMinutes: number }
  | { kind: "too_early"; student: Student; remainingMinutes: number }
  | { kind: "already_complete"; student: Student }
  | { kind: "not_recognized" }

// ── helpers ─────────────────────────────────────────────────────────────────
const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}
function timeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
function genId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── persistence ─────────────────────────────────────────────────────────────
const KEY = "tapin_v1"

interface Store {
  students: Student[]
  schedule: ScheduleDay[]
  attendance: AttendanceRecord[]
  activeSessions: ActiveSession[]
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      // Rehydrate dates
      parsed.activeSessions = (parsed.activeSessions ?? []).map((s) => ({
        ...s,
        clockedInAt: new Date(s.clockedInAt),
      }))
      return parsed
    }
  } catch {}
  return {
    students: [
      {
        id: genId(),
        name: "Maria Santos",
        studentId: "2024-001",
        status: "active",
        cardId: "CARD-A1B2",
        schedule: [
          { day: "monday", start: "08:00", end: "12:00", minimumMinutes: 180 },
          { day: "tuesday", start: "08:00", end: "12:00", minimumMinutes: 180 },
          { day: "wednesday", start: "08:00", end: "12:00", minimumMinutes: 180 },
          { day: "thursday", start: "08:00", end: "12:00", minimumMinutes: 180 },
          { day: "friday", start: "08:00", end: "12:00", minimumMinutes: 180 },
        ],
      },
      {
        id: genId(),
        name: "Juan Cruz",
        studentId: "2024-002",
        status: "active",
        cardId: "CARD-C3D4",
        schedule: [
          { day: "tuesday", start: "13:00", end: "17:00", minimumMinutes: 120 },
          { day: "thursday", start: "13:00", end: "17:00", minimumMinutes: 120 },
          { day: "friday", start: "08:00", end: "11:00", minimumMinutes: 90 },
        ],
      },
      {
        id: genId(),
        name: "Ana Reyes",
        studentId: "2024-003",
        status: "inactive",
      },
      {
        id: genId(),
        name: "Carlo Mendoza",
        studentId: "2024-004",
        status: "active",
        cardId: "CARD-E5F6",
      },
      {
        id: genId(),
        name: "Lea Villanueva",
        studentId: "2024-005",
        status: "active",
      },
    ],
    schedule: [
      { day: "monday", start: "08:00", end: "17:00", minimumMinutes: 120 },
      { day: "tuesday", start: "08:00", end: "17:00", minimumMinutes: 120 },
      { day: "wednesday", start: "08:00", end: "17:00", minimumMinutes: 120 },
      { day: "thursday", start: "08:00", end: "17:00", minimumMinutes: 120 },
      { day: "friday", start: "08:00", end: "17:00", minimumMinutes: 120 },
      { day: "saturday", start: "09:00", end: "12:00", minimumMinutes: 90 },
    ],
    attendance: [
      {
        id: genId(),
        studentId: "2024-001",
        studentName: "Maria Santos",
        date: "2026-08-04",
        clockIn: "08:03",
        clockOut: "10:11",
        durationMinutes: 128,
        status: "complete",
      },
      {
        id: genId(),
        studentId: "2024-002",
        studentName: "Juan Cruz",
        date: "2026-08-04",
        clockIn: "08:15",
        clockOut: "10:22",
        durationMinutes: 127,
        status: "complete",
      },
      {
        id: genId(),
        studentId: "2024-004",
        studentName: "Carlo Mendoza",
        date: "2026-08-04",
        clockIn: "08:30",
        clockOut: "09:45",
        durationMinutes: 75,
        status: "incomplete",
      },
      {
        id: genId(),
        studentId: "2024-001",
        studentName: "Maria Santos",
        date: "2026-08-05",
        clockIn: "08:01",
        clockOut: "10:05",
        durationMinutes: 124,
        status: "complete",
      },
      {
        id: genId(),
        studentId: "2024-002",
        studentName: "Juan Cruz",
        date: "2026-08-05",
        clockIn: "08:20",
        clockOut: "10:25",
        durationMinutes: 125,
        status: "complete",
      },
    ],
    activeSessions: [],
  }
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

let _s: Store = load()

let _version = 0
const _listeners = new Set<() => void>()

function persist() {
  save(_s)
  _version++
  _listeners.forEach((l) => l())
}

export function subscribeStore(listener: () => void) {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

export function getVersion() {
  return _version
}

// ── public API ───────────────────────────────────────────────────────────────
export const db = {
  // students
  getStudents: (): Student[] => _s.students,

  addStudent(
    name: string,
    studentId: string,
    status: StudentStatus = "active",
  ): Student {
    const s: Student = { id: genId(), name, studentId, status }
    _s.students.push(s)
    persist()
    return s
  },

  updateStudent(id: string, patch: Partial<Omit<Student, "id">>) {
    const idx = _s.students.findIndex((s) => s.id === id)
    if (idx >= 0) {
      _s.students[idx] = { ..._s.students[idx], ...patch }
      persist()
    }
  },

  deleteStudent(id: string) {
    _s.students = _s.students.filter((s) => s.id !== id)
    persist()
  },

  // ── unified import: students + per-student schedules in one file ──────────
  importUnifiedCSV(rows: Record<string, string>[]): CSVImportResult {
    const result: CSVImportResult = { students: 0, slots: 0, defaultSlots: 0 }
    for (const row of rows) {
      const isStudentRow = !!row.name && !!row.student_id

      if (isStudentRow) {
        const status: StudentStatus =
          row.status === "inactive" ? "inactive" : "active"
        const existing = _s.students.find(
          (s) => s.studentId === row.student_id,
        )
        if (existing) {
          existing.name = row.name
          existing.status = status
        } else {
          _s.students.push({
            id: genId(),
            name: row.name,
            studentId: row.student_id,
            status,
          })
          result.students++
        }
      }

      if (row.day && row.start && row.end && row.minimum_minutes) {
        const slot: ScheduleDay = {
          day: row.day.toLowerCase(),
          start: row.start,
          end: row.end,
          minimumMinutes: parseInt(row.minimum_minutes) || 0,
        }
        if (isStudentRow) {
          const student = _s.students.find(
            (s) => s.studentId === row.student_id,
          )
          if (student) {
            if (!student.schedule) student.schedule = []
            const idx = student.schedule.findIndex((d) => d.day === slot.day)
            if (idx >= 0) student.schedule[idx] = slot
            else student.schedule.push(slot)
            result.slots++
          }
        } else {
          const idx = _s.schedule.findIndex((d) => d.day === slot.day)
          if (idx >= 0) _s.schedule[idx] = slot
          else _s.schedule.push(slot)
          result.defaultSlots++
        }
      }
    }
    persist()
    return result
  },

  // ── schedules ─────────────────────────────────────────────────────────────
  getSchedule: (): ScheduleDay[] => _s.schedule,

  setScheduleDay(
    day: string,
    start: string,
    end: string,
    minimumMinutes: number,
  ) {
    const idx = _s.schedule.findIndex((d) => d.day === day)
    if (idx >= 0) _s.schedule[idx] = { day, start, end, minimumMinutes }
    else _s.schedule.push({ day, start, end, minimumMinutes })
    persist()
  },

  removeScheduleDay(day: string) {
    _s.schedule = _s.schedule.filter((d) => d.day !== day)
    persist()
  },

  // per-student schedules
  getStudentSchedule(id: string): ScheduleDay[] {
    const student = _s.students.find((s) => s.id === id)
    return student?.schedule?.length ? student.schedule : []
  },

  getEffectiveSchedule(id: string): ScheduleDay[] {
    const student = _s.students.find((s) => s.id === id)
    if (!student) return _s.schedule
    return student.schedule?.length ? student.schedule : _s.schedule
  },

  hasCustomSchedule(id: string): boolean {
    const student = _s.students.find((s) => s.id === id)
    return !!student?.schedule?.length
  },

  setStudentScheduleDay(
    id: string,
    day: string,
    start: string,
    end: string,
    minimumMinutes: number,
  ) {
    const student = _s.students.find((s) => s.id === id)
    if (!student) return
    if (!student.schedule) student.schedule = []
    const slot: ScheduleDay = { day, start, end, minimumMinutes }
    const idx = student.schedule.findIndex((d) => d.day === day)
    if (idx >= 0) student.schedule[idx] = slot
    else student.schedule.push(slot)
    persist()
  },

  removeStudentScheduleDay(id: string, day: string) {
    const student = _s.students.find((s) => s.id === id)
    if (!student?.schedule) return
    student.schedule = student.schedule.filter((d) => d.day !== day)
    persist()
  },

  copyDefaultSchedule(id: string) {
    const student = _s.students.find((s) => s.id === id)
    if (!student) return
    student.schedule = _s.schedule.map((d) => ({ ...d }))
    persist()
  },

  // cards
  writeCard(studentId_field: string, cardId: string): boolean {
    const student = _s.students.find((s) => s.studentId === studentId_field)
    if (!student) return false
    for (const s of _s.students)
      if (s.cardId === cardId && s.id !== student.id) s.cardId = undefined
    student.cardId = cardId
    persist()
    return true
  },

  readCard(cardId: string): { student?: Student; isTapIn: boolean } {
    const student = _s.students.find((s) => s.cardId === cardId)
    return { student, isTapIn: cardId.startsWith("CARD-") }
  },

  blankCard(cardId: string) {
    for (const s of _s.students) if (s.cardId === cardId) s.cardId = undefined
    persist()
  },

  // sessions
  isClocked: (studentId: string) =>
    _s.activeSessions.some((s) => s.studentId === studentId),
  getActiveSessions: (): ActiveSession[] => _s.activeSessions,

  // ── tap logic ──────────────────────────────────────────────────────────────
  tap(cardId: string): TapResult {
    const now = new Date()
    const student = _s.students.find((s) => s.cardId === cardId)

    // Unknown or inactive card
    if (!student || student.status !== "active")
      return { kind: "not_recognized" }

    const today = DAYS[now.getDay()]
    const studentSched = student.schedule?.length ? student.schedule : _s.schedule
    const sched = studentSched.find((d) => d.day === today)
    const session = _s.activeSessions.find((s) => s.studentId === student.id)

    // ── already clocked in → try to clock out ─────────────────────────────
    if (session) {
      const elapsed = Math.floor(
        (now.getTime() - new Date(session.clockedInAt).getTime()) / 60000,
      )
      const required = sched?.minimumMinutes ?? 0

      if (elapsed < required) {
        return {
          kind: "too_early",
          student,
          remainingMinutes: required - elapsed,
        }
      }

      // Clock out
      _s.activeSessions = _s.activeSessions.filter(
        (s) => s.studentId !== student.id,
      )
      const rec = _s.attendance.find(
        (r) =>
          r.studentId === student.studentId &&
          r.date === dateStr(now) &&
          r.status === "in_progress",
      )
      if (rec) {
        rec.clockOut = timeStr(now)
        rec.durationMinutes = elapsed
        rec.status = elapsed >= required ? "complete" : "incomplete"
      }
      persist()
      return { kind: "clocked_out", student, durationMinutes: elapsed }
    }

    // ── not clocked in → try to clock in ──────────────────────────────────
    // Already done today?
    const todayStr = dateStr(now)
    const done = _s.attendance.find(
      (r) =>
        r.studentId === student.studentId &&
        r.date === todayStr &&
        r.status !== "in_progress",
    )
    if (done) return { kind: "already_complete", student }

    // Inside schedule window? Off-window taps are still accepted but flagged
    // as an override so sudden schedule changes can be handled at the reader.
    const nowM = now.getHours() * 60 + now.getMinutes()
    const inWindow =
      !!sched &&
      nowM >= toMinutes(sched.start) &&
      nowM < toMinutes(sched.end)

    // Clock in
    _s.activeSessions.push({ studentId: student.id, cardId, clockedInAt: now })
    _s.attendance.push({
      id: genId(),
      studentId: student.studentId,
      studentName: student.name,
      date: todayStr,
      clockIn: timeStr(now),
      status: "in_progress",
      override: inWindow ? undefined : true,
    })
    persist()
    return {
      kind: "clocked_in",
      student,
      override: inWindow ? undefined : true,
    }
  },

  // attendance
  getAttendance: (): AttendanceRecord[] => _s.attendance,

  exportAttendanceCSV(): string {
    const header =
      "date,student_id,name,clock_in,clock_out,duration_minutes,status,override"
    const rows = _s.attendance
      .filter((r) => r.status !== "in_progress")
      .map(
        (r) =>
          `${r.date},${r.studentId},${r.studentName},${r.clockIn},${r.clockOut ?? ""},${r.durationMinutes ?? ""},${r.status},${r.override ? "yes" : ""}`,
      )
    return [header, ...rows].join("\n")
  },
}

// ── CSV parser ───────────────────────────────────────────────────────────────
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => (obj[h] = vals[i] ?? ""))
    return obj
  })
}

export function generateCardId() {
  return "CARD-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}
