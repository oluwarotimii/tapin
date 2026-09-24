import { authorizeRequest, authFailResponse } from "@/server/guard"
import { enrollFingerprint, removeFingerprint } from "@/server/students"
import { fingerprintEnroll, fingerprintRemove } from "@/lib/validation"

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
  const url = new URL(req.url)
  const parsed = fingerprintRemove.safeParse({
    finger: url.searchParams.get("finger") ?? undefined,
  })
  if (!parsed.success)
    return Response.json({ error: "invalid input" }, { status: 400 })
  await removeFingerprint(id, parsed.data.finger)
  return Response.json({ ok: true })
}
