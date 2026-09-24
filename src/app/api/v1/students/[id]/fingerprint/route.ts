import { authorizeRequest, authFailResponse } from "@/server/guard"
import { enrollFingerprint, removeFingerprint } from "@/server/students"
import { fingerprintEnroll } from "@/lib/validation"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["fingerprints_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  const parsed = fingerprintEnroll.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  const ok = await enrollFingerprint(id, parsed.data.finger, parsed.data.template)
  if (!ok) return Response.json({ error: "student not found" }, { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeRequest(req, ["fingerprints_write"])
  if (!auth.ok) return authFailResponse(auth)
  const { id } = await ctx.params
  await removeFingerprint(id)
  return Response.json({ ok: true })
}
