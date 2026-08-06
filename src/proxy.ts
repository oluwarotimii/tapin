import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const SESSION_COOKIE = "tapin_session"
const LOGIN_URL = "/login"

export const config = {
  matcher: ["/admin/:path*"],
}

export default async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const toLogin = () =>
    NextResponse.redirect(new URL(LOGIN_URL, req.url))

  if (!token) return toLogin()

  const secret = process.env.AUTH_SECRET
  if (!secret) return toLogin()

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    )
    if (!payload.sub) return toLogin()
  } catch {
    return toLogin()
  }

  return NextResponse.next()
}