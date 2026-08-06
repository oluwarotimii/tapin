import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data")

// ── CSV helpers ──────────────────────────────────────────────────────────────
function readCSV(file) {
  const path = join(DATA_DIR, file)
  let text
  try {
    text = readFileSync(path, "utf8")
  } catch {
    console.warn(`  [skip] missing ${file}`)
    return []
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim())
    const obj = {}
    headers.forEach((h, i) => (obj[h] = vals[i] ?? ""))
    return obj
  })
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

// ── seed ─────────────────────────────────────────────────────────────────────
async function main() {
  const studentsCSV = readCSV("students.csv")
  const schedulesCSV = readCSV("schedules.csv")
  const attendanceCSV = readCSV("attendance.csv")

  // Reset app data (students + everything under them) and API keys.
  // The admin User account is preserved.
  await prisma.$transaction(async (tx) => {
    await tx.activeSession.deleteMany()
    await tx.attendanceRecord.deleteMany()
    await tx.scheduleDay.deleteMany()
    await tx.student.deleteMany()
    await tx.apiKey.deleteMany()
  })

  let students = 0
  let slots = 0
  let defaultSlots = 0
  let attendance = 0

  // 1. Students
  for (const row of studentsCSV) {
    if (!row.name || !row.student_id) continue
    const status = row.status === "inactive" ? "inactive" : "active"
    await prisma.student.upsert({
      where: { studentId: row.student_id },
      create: { name: row.name, studentId: row.student_id, status },
      update: { name: row.name, status },
    })
    students++
  }

  // 2. Schedules
  for (const row of schedulesCSV) {
    if (!row.day || !row.start || !row.end || !row.minimum_minutes) continue
    const studentId = row.student_id ? String(row.student_id) : null
    const minimumMinutes = parseInt(row.minimum_minutes) || 0

    if (studentId) {
      const s = await prisma.student.findUnique({ where: { studentId } })
      if (!s) {
        console.warn(
          `  [warn] schedule references unknown student "${studentId}" — creating placeholder (add a real row to students.csv)`,
        )
        await prisma.student.create({
          data: { name: studentId, studentId, status: "active" },
        })
      }
      // resolve internal id
      const st = await prisma.student.findUnique({ where: { studentId } })
      await prisma.scheduleDay.deleteMany({ where: { studentId: st.id, day: row.day } })
      await prisma.scheduleDay.create({
        data: {
          studentId: st.id,
          day: row.day,
          start: row.start,
          end: row.end,
          minimumMinutes,
        },
      })
      slots++
    } else {
      await prisma.scheduleDay.deleteMany({ where: { studentId: null, day: row.day } })
      await prisma.scheduleDay.create({
        data: { studentId: null, day: row.day, start: row.start, end: row.end, minimumMinutes },
      })
      defaultSlots++
    }
  }

  // 3. Attendance backfill (optional)
  for (const row of attendanceCSV) {
    if (!row.student_id || !row.date || !row.clock_in) continue
    const st = await prisma.student.findUnique({ where: { studentId: row.student_id } })
    if (!st) {
      console.warn(`  [skip] attendance references unknown student "${row.student_id}"`)
      continue
    }
    const duration =
      row.duration_minutes && parseInt(row.duration_minutes)
        ? parseInt(row.duration_minutes)
        : row.clock_out
          ? Math.max(0, toMinutes(row.clock_out) - toMinutes(row.clock_in))
          : undefined
    const status = row.status === "incomplete" ? "incomplete" : "complete"
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: st.id, date: row.date } },
      create: {
        studentId: st.id,
        date: row.date,
        clockIn: row.clock_in,
        clockOut: row.clock_out || null,
        durationMinutes: duration ?? null,
        status,
        override: row.override === "yes",
        source: row.source || "import",
      },
      update: {
        clockIn: row.clock_in,
        clockOut: row.clock_out || null,
        durationMinutes: duration ?? null,
        status,
        source: row.source || "import",
      },
    })
    attendance++
  }

  const adminCount = await prisma.user.count()
  console.log(`Seed complete (admin accounts preserved: ${adminCount})`)
  console.log(`  students: ${students}`)
  console.log(`  student schedule slots: ${slots}`)
  console.log(`  default template slots: ${defaultSlots}`)
  console.log(`  attendance records: ${attendance}`)
  console.log("Next: edit prisma/data/*.csv and run `pnpm db:seed` again to re-apply.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
