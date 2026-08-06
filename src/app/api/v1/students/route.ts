import { authorizeRequest, authFailResponse } from "@/server/guard"
import { getStudents } from "@/server/domain"
import { addStudent } from "@/server/students"
import { studentCreate } from "@/lib/validation"

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["students_read"], {
    allowPublic: true,
  })
  if (!auth.ok) return authFailResponse(auth)
  const students = await getStudents()
  if (auth.auth.type === "public") {
    // The kiosk only needs identity fields — never expose card IDs or schedules.
    return Response.json({
      students: students.map(({ id, studentId, name, status }) => ({
        id,
        studentId,
        name,
        status,
      })),
    })
  }
  return Response.json({ students })
}

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["students_write"])
  if (!auth.ok) return authFailResponse(auth)
  const parsed = studentCreate.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  try {
    const s = await addStudent(
      parsed.data.name,
      parsed.data.student_id,
      parsed.data.status ?? "active",
    )
    return Response.json({ student: s }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique")
      ? "student_id already exists"
      : "failed to create student"
    return Response.json({ error: msg }, { status: 409 })
  }
}
