import { prisma } from "@/lib/db"
import { createSession, verifyPassword } from "@/lib/session"
import { loginRequest } from "@/lib/validation"

export async function POST(req: Request) {
  const parsed = loginRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return Response.json({ error: "invalid credentials" }, { status: 401 })

  await createSession({ id: user.id, email: user.email, name: user.name })
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } })
}
