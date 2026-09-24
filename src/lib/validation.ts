import { z } from "zod"

export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
export const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const studentCreate = z.object({
  name: z.string().min(1).max(120),
  student_id: z.string().min(1).max(60),
  status: z.enum(["active", "inactive"]).optional(),
})

export const studentUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  student_id: z.string().min(1).max(60).optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const scheduleDay = z.object({
  day: z.enum([
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ]),
  start: z.string().regex(timePattern),
  end: z.string().regex(timePattern),
  minimum_minutes: z.number().int().min(0).max(24 * 60),
})

export const tapRequest = z
  .object({
    card_id: z.string().min(1).max(100).optional(),
    student_id: z.string().min(1).max(60).optional(),
  })
  .refine((d) => !!d.card_id !== !!d.student_id, {
    message: "exactly one of card_id or student_id is required",
  })

export const fingerprintEnroll = z.object({
  finger: z.string().min(1).max(40),
  template: z.string().min(1).max(20000),
})

export const fingerprintRemove = z.object({
  finger: z.string().min(1).max(40).optional(),
})

export const attendancePush = z.object({
  student_id: z.string().min(1),
  date: z.string().regex(datePattern),
  clock_in: z.string().regex(timePattern),
  clock_out: z.string().regex(timePattern).optional(),
  duration_minutes: z.number().int().min(0).optional(),
  status: z.enum(["complete", "incomplete"]).optional(),
  override: z.boolean().optional(),
  source: z.string().max(40).optional(),
})

export const cardWrite = z.object({
  student_id: z.string().min(1),
  card_id: z.string().min(1).max(100),
})

export const cardBlank = z.object({
  card_id: z.string().min(1).max(100),
})

export const apiKeyCreate = z.object({
  name: z.string().min(1).max(120),
  scopes: z
    .array(
      z.enum([
        "students_read",
        "students_write",
        "schedules_read",
        "schedules_write",
        "attendance_read",
        "attendance_write",
        "taps_write",
        "cards_write",
        "fingerprints_write",
      ]),
    )
    .min(1),
  expires_at: z.string().datetime().optional(),
})

export const registerRequest = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
})

export const loginRequest = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
})
