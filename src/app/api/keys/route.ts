import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { generateApiKey } from "@/lib/apiKey"
import { apiKeyCreate } from "@/lib/validation"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 })
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      active: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  })
  return Response.json({ keys })
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: "not authenticated" }, { status: 401 })

  const parsed = apiKeyCreate.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })

  const { name, scopes, expires_at } = parsed.data
  const { key, prefix, hash } = generateApiKey()
  const created = await prisma.apiKey.create({
    data: {
      name,
      prefix,
      keyHash: hash,
      scopes,
      expiresAt: expires_at ? new Date(expires_at) : null,
    },
  })

  return Response.json({
    key: {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      scopes: created.scopes,
    },
    api_key: key,
  })
}
