import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db"

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.apiKey.delete({ where: { id } })
  return Response.json({ ok: true })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  const active = typeof body?.active === "boolean" ? body.active : undefined
  const name = typeof body?.name === "string" ? body.name : undefined
  await prisma.apiKey.update({ where: { id }, data: { active, name } })
  return Response.json({ ok: true })
}
