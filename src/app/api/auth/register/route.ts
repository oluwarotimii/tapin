import { prisma } from "@/lib/db"
import { createSession, hashPassword, adminCount } from "@/lib/session"
import { registerRequest } from "@/lib/validation"

export async function POST(req: Request) {
  const count = await adminCount()
  if (count > 0)
    return Response.json({ error: "setup already complete" }, { status: 409 })

  const parsed = registerRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const { name, email, password } = parsed.data
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  })
  await createSession({ id: user.id, email: user.email, name: user.name })
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } })
}
