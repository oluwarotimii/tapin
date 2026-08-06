import { authorizeRequest, authFailResponse } from "@/server/guard"
import { updateStudent, deleteStudent } from "@/server/students"
import { studentUpdate } from "@/lib/validation"

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["students_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  const parsed = studentUpdate.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  try {
    const s = await updateStudent(id, parsed.data)
    return Response.json({ student: s })
  } catch {
    return Response.json({ error: "student not found" }, { status: 404 })
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["students_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  await deleteStudent(id)
  return Response.json({ ok: true })
}
