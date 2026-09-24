import { api, apiText } from "./lib/api"
import { DAYS, generateCardId, type ActiveSession, type AttendanceRecord, type CSVImportResult, type ScheduleDay, type Student, type StudentStatus, type TapResult } from "./lib/types"
import { parseCSV } from "./lib/csv"

export type {
  ActiveSession,
  AttendanceRecord,
  AttendanceStatus,
  CSVImportResult,
  ScheduleDay,
  Student,
  StudentStatus,
  TapResult,
} from "./lib/types"
export { parseCSV }
export { generateCardId }

interface Cache {
  students: Student[]
  schedule: ScheduleDay[]
  attendance: AttendanceRecord[]
  activeSessions: ActiveSession[]
  loaded: boolean
}

let _c: Cache = {
  students: [],
  schedule: [],
  attendance: [],
  activeSessions: [],
  loaded: false,
}

let _version = 0
const _listeners = new Set<() => void>()
let _loading: Promise<void> | null = null

function bump() {
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

async function persist(path: string, init: RequestInit) {
  try {
    await api<unknown>(path, init)
  } catch (e) {
    console.error(`[tapin] sync failed:`, e)
    await loadAll()
  }
}

// ── data loading ─────────────────────────────────────────────────────────────
export async function loadAll() {
  if (_loading) return _loading
  _loading = (async () => {
    try {
      // Endpoints that aren't public (e.g. attendance) may 401 on the kiosk;
      // load whatever is accessible rather than failing the whole cache.
      const [students, schedule, attendance, sessions] = await Promise.all([
        api<{ students: Student[] }>("/api/v1/students").catch(() => null),
        api<{ schedule: ScheduleDay[] }>("/api/v1/schedule").catch(() => null),
        api<{ attendance: AttendanceRecord[] }>("/api/v1/attendance").catch(
          () => null,
        ),
        api<{ sessions: ActiveSession[] }>("/api/v1/sessions").catch(() => null),
      ])
      if (students) _c.students = students.students
      if (schedule) _c.schedule = schedule.schedule
      if (attendance) _c.attendance = attendance.attendance
      if (sessions) _c.activeSessions = sessions.sessions
      _c.loaded = true
      bump()
    } finally {
      _loading = null
    }
  })()
  return _loading
}

export function isLoaded() {
  return _c.loaded
}

// ── cache helpers ────────────────────────────────────────────────────────────
function sortStudents() {
  _c.students.sort((a, b) => (a.studentId < b.studentId ? -1 : 1))
}

function upsertStudent(s: Student) {
  const idx = _c.students.findIndex((x) => x.id === s.id)
  if (idx >= 0) _c.students[idx] = s
  else _c.students.push(s)
  sortStudents()
}

function replaceScheduleSlot(arr: ScheduleDay[], slot: ScheduleDay) {
  const idx = arr.findIndex((d) => d.day === slot.day)
  if (idx >= 0) arr[idx] = slot
  else arr.push(slot)
}

// ── public API ───────────────────────────────────────────────────────────────
export const db = {
  load: loadAll,
  getVersion,

  // students
  getStudents: (): Student[] => _c.students,

  addStudent(name: string, studentId: string, status: StudentStatus = "active") {
    const s: Student = { id: `tmp-${crypto.randomUUID()}`, name, studentId, status }
    _c.students.push(s)
    sortStudents()
    bump()
    persist("/api/v1/students", {
      method: "POST",
      body: JSON.stringify({ name, student_id: studentId, status }),
    })
    return s
  },

  updateStudent(id: string, patch: Partial<Omit<Student, "id">>) {
    const idx = _c.students.findIndex((s) => s.id === id)
    if (idx >= 0) {
      _c.students[idx] = { ..._c.students[idx], ...patch }
      sortStudents()
      bump()
    }
    persist(`/api/v1/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
  },

  deleteStudent(id: string) {
    _c.students = _c.students.filter((s) => s.id !== id)
    _c.attendance = _c.attendance.filter(
      (r) => _c.students.findIndex((s) => s.studentId === r.studentId) >= 0,
    )
    _c.activeSessions = _c.activeSessions.filter((s) => s.studentId !== id)
    bump()
    persist(`/api/v1/students/${id}`, { method: "DELETE" })
  },

  // ── unified import ─────────────────────────────────────────────────────────
  async importUnifiedCSV(rows: Record<string, string>[]): Promise<CSVImportResult> {
    const csvText = serializeRows(rows)
    const res = await api<{ result: CSVImportResult }>("/api/v1/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: csvText,
    })
    await loadAll()
    return res.result
  },

  // ── default schedule ───────────────────────────────────────────────────────
  getSchedule: (): ScheduleDay[] => _c.schedule,

  setScheduleDay(day: string, start: string, end: string, minimumMinutes: number) {
    replaceScheduleSlot(_c.schedule, { day, start, end, minimumMinutes })
    bump()
    persist("/api/v1/schedule", {
      method: "POST",
      body: JSON.stringify({ day, start, end, minimum_minutes: minimumMinutes }),
    })
  },

  removeScheduleDay(day: string) {
    _c.schedule = _c.schedule.filter((d) => d.day !== day)
    bump()
    persist(`/api/v1/schedule/${day}`, { method: "DELETE" })
  },

  // ── per-student schedules ──────────────────────────────────────────────────
  getStudentSchedule(id: string): ScheduleDay[] {
    const s = _c.students.find((x) => x.id === id)
    return s?.schedule ?? []
  },

  getEffectiveSchedule(id: string): ScheduleDay[] {
    const s = _c.students.find((x) => x.id === id)
    return s?.schedule?.length ? s.schedule : _c.schedule
  },

  hasCustomSchedule(id: string): boolean {
    return !!(_c.students.find((x) => x.id === id)?.schedule?.length)
  },

  setStudentScheduleDay(
    id: string,
    day: string,
    start: string,
    end: string,
    minimumMinutes: number,
  ) {
    const s = _c.students.find((x) => x.id === id)
    if (!s) return
    if (!s.schedule) s.schedule = []
    replaceScheduleSlot(s.schedule, { day, start, end, minimumMinutes })
    bump()
    persist(`/api/v1/students/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ day, start, end, minimum_minutes: minimumMinutes }),
    })
  },

  removeStudentScheduleDay(id: string, day: string) {
    const s = _c.students.find((x) => x.id === id)
    if (!s?.schedule) return
    s.schedule = s.schedule.filter((d) => d.day !== day)
    bump()
    persist(`/api/v1/students/${id}/schedule?day=${day}`, { method: "DELETE" })
  },

  copyDefaultSchedule(id: string) {
    const s = _c.students.find((x) => x.id === id)
    if (!s) return
    s.schedule = _c.schedule.map((d) => ({ ...d }))
    bump()
    persist(`/api/v1/students/${id}/schedule/copy`, { method: "POST" })
  },

  // ── cards ──────────────────────────────────────────────────────────────────
  async writeCard(studentId: string, cardId: string): Promise<boolean> {
    const res = await api<{ ok: boolean }>("/api/v1/cards", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, card_id: cardId }),
    })
    if (res.ok) {
      _c.students.forEach((s) => {
        if (s.cardId === cardId && s.studentId !== studentId) s.cardId = undefined
      })
      const target = _c.students.find((s) => s.studentId === studentId)
      if (target) target.cardId = cardId
      bump()
    }
    return res.ok
  },

  async readCard(cardId: string): Promise<{ student?: Student; isTapIn: boolean }> {
    await new Promise((r) => setTimeout(r, 300))
    const student = _c.students.find((s) => s.cardId === cardId)
    return { student, isTapIn: cardId.startsWith("CARD-") }
  },

  async blankCard(cardId: string) {
    await api<{ ok: boolean }>("/api/v1/cards", {
      method: "POST",
      body: JSON.stringify({ blank: true, card_id: cardId }),
    })
    _c.students.forEach((s) => {
      if (s.cardId === cardId) s.cardId = undefined
    })
    bump()
  },

  // ── fingerprints (one per student — enrolling again replaces it) ───────────
  async enrollFingerprint(id: string, finger: string, template: string) {
    const res = await api<{ ok: boolean }>(`/api/v1/students/${id}/fingerprint`, {
      method: "POST",
      body: JSON.stringify({ finger, template }),
    })
    if (res.ok) {
      const target = _c.students.find((s) => s.id === id)
      if (target) target.fingerprintCount = 1
      bump()
    }
    return res.ok
  },

  async removeFingerprint(id: string) {
    await api<{ ok: boolean }>(`/api/v1/students/${id}/fingerprint`, {
      method: "DELETE",
    })
    await loadAll()
  },

  // ── sessions ───────────────────────────────────────────────────────────────
  isClocked: (studentId: string) =>
    _c.activeSessions.some((s) => s.studentId === studentId),
  getActiveSessions: (): ActiveSession[] => _c.activeSessions,

  // ── tap (called by the reader seam) ────────────────────────────────────────
  async tapCard(cardId: string): Promise<TapResult> {
    const res = await api<{ result: TapResult }>("/api/v1/taps", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId }),
    })
    applyTapResult(res.result, cardId)
    return res.result
  },

  async tapFingerprint(studentId: string): Promise<TapResult> {
    const res = await api<{ result: TapResult }>("/api/v1/taps", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    })
    applyTapResult(res.result, null)
    return res.result
  },

  // ── attendance ─────────────────────────────────────────────────────────────
  getAttendance: (): AttendanceRecord[] => _c.attendance,

  async exportAttendanceCSV(): Promise<string> {
    return apiText("/api/v1/attendance/export")
  },
}

function applyTapResult(result: TapResult, cardId: string | null) {
  if (result.kind === "clocked_in") {
    _c.activeSessions.push({
      studentId: result.student.id,
      cardId,
      clockedInAt: new Date().toISOString(),
      studentName: result.student.name,
    })
    _c.attendance.push({
      id: `tmp-${crypto.randomUUID()}`,
      studentId: result.student.studentId,
      studentName: result.student.name,
      date: new Date().toISOString().slice(0, 10),
      clockIn: new Date().toTimeString().slice(0, 5),
      status: "in_progress",
      override: result.override,
    })
  } else if (result.kind === "clocked_out") {
    _c.activeSessions = _c.activeSessions.filter(
      (s) => s.studentId !== result.student.id,
    )
    const rec = _c.attendance.find(
      (r) =>
        r.studentId === result.student.studentId &&
        r.status === "in_progress",
    )
    if (rec) {
      rec.clockOut = new Date().toTimeString().slice(0, 5)
      rec.durationMinutes = result.durationMinutes
      rec.status =
        result.durationMinutes >= (effectiveMinutes(result.student) ?? 0)
          ? "complete"
          : "incomplete"
    }
  }
  bump()
}

function effectiveMinutes(student: Student): number | undefined {
  const today = DAYS[new Date().getDay()]
  const sched = student.schedule?.length ? student.schedule : _c.schedule
  return sched.find((d) => d.day === today)?.minimumMinutes
}

function serializeRows(rows: Record<string, string>[]): string {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? "").join(","))
  }
  return lines.join("\n")
}

export function useStoreReady() {
  return _c.loaded
}
