export type StudentStatus = "active" | "inactive"

export interface ScheduleDay {
  id?: string
  day: string
  start: string // "HH:MM"
  end: string // "HH:MM"
  minimumMinutes: number
}

export interface Student {
  id: string
  studentId: string
  name: string
  status: StudentStatus
  cardId?: string | null
  schedule?: ScheduleDay[]
  fingerprintCount?: number
}

export type AttendanceStatus = "complete" | "incomplete" | "in_progress"

export interface AttendanceRecord {
  id: string
  studentId: string // Student.studentId (stable external id)
  studentName: string
  date: string
  clockIn: string
  clockOut?: string
  durationMinutes?: number
  status: AttendanceStatus
  override?: boolean
  source?: string
}

export interface ActiveSession {
  studentId: string // Student.id (internal)
  cardId: string | null
  clockedInAt: string
  studentName?: string
}

export type TapResult =
  | { kind: "clocked_in"; student: Student; override?: boolean }
  | { kind: "clocked_out"; student: Student; durationMinutes: number }
  | { kind: "too_early"; student: Student; remainingMinutes: number }
  | { kind: "already_complete"; student: Student }
  | { kind: "not_recognized" }

export interface CSVImportResult {
  students: number
  slots: number
  defaultSlots: number
}

export interface TapEvent {
  id: string
  cardId: string
  result: TapResult
  time: string
  source: string
}

export const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

export function pad(n: number) {
  return String(n).padStart(2, "0")
}
export function timeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
export function generateCardId() {
  return "CARD-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}
