import "server-only"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { hashApiKey } from "@/lib/apiKey"
import { getSessionUser } from "@/lib/session"

export type ApiScope =
  | "students_read"
  | "students_write"
  | "schedules_read"
  | "schedules_write"
  | "attendance_read"
  | "attendance_write"
  | "taps_write"
  | "cards_write"
  | "fingerprints_write"

export interface AuthOk {
  ok: true
  auth:
    | { type: "session"; userId: string }
    | { type: "key"; keyId: string }
    | { type: "public" }
}

export interface AuthFail {
  ok: false
  status: number
  body: { error: string }
}

export type AuthResult = AuthOk | AuthFail

function fail(status: number, error: string): AuthFail {
  return { ok: false, status, body: { error } }
}

async function verifySessionToken(token: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    )
    if (!payload.sub) return null
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    return user ? { userId: user.id } : null
  } catch {
    return null
  }
}

async function verifyApiKey(raw: string): Promise<
  { ok: true; keyId: string; scopes: ApiScope[] } | { ok: false }
> {
  const hash = hashApiKey(raw)
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } })
  if (!key || !key.active) return { ok: false }
  if (key.expiresAt && key.expiresAt.getTime() < Date.now())
    return { ok: false }
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })
  return { ok: true, keyId: key.id, scopes: key.scopes as ApiScope[] }
}

function hasScopes(actual: ApiScope[], required: ApiScope[]) {
  return required.every((s) => actual.includes(s))
}

/**
 * Authorizes an API request. Accepts, in priority order:
 *  1. `Authorization: Bearer tp_...` API key (must have every required scope)
 *  2. `Authorization: Bearer <session-jwt>` admin session token
 *  3. `tapin_session` cookie (admin session)
 *
 * With `allowPublic`, an anonymous request (no credentials at all) is granted
 * `auth.type = "public"` instead of failing. Presenting invalid credentials is
 * still rejected. This powers the public tap kiosk; routes must sanitize any
 * sensitive fields when the caller is `public`.
 */
export async function authorizeRequest(
  req: Request,
  required: ApiScope[],
  opts?: { allowPublic?: boolean },
): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization")

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token.startsWith("tp_")) {
      const k = await verifyApiKey(token)
      if (!k.ok) return fail(401, "invalid or inactive API key")
      if (!hasScopes(k.scopes, required))
        return fail(403, `requires scope: ${required.join(", ")}`)
      return { ok: true, auth: { type: "key", keyId: k.keyId } }
    }
    const s = await verifySessionToken(token)
    if (s) return { ok: true, auth: { type: "session", userId: s.userId } }
    return fail(401, "invalid session token")
  }

  const sessionUser = await getSessionUser()
  if (sessionUser) return { ok: true, auth: { type: "session", userId: sessionUser.id } }
  if (opts?.allowPublic) return { ok: true, auth: { type: "public" } }
  return fail(401, "not authenticated")
}

export function authFailResponse(r: AuthFail) {
  return Response.json(r.body, { status: r.status })
}
