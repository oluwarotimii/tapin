import "server-only"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/db"

export const API_KEY_SCOPES = [
  "students_read",
  "students_write",
  "schedules_read",
  "schedules_write",
  "attendance_read",
  "attendance_write",
  "taps_write",
  "cards_write",
  "fingerprints_write",
] as const

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

export function isApiKeyScope(v: string): v is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(v)
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = `tp_${randomBytes(24).toString("base64url")}`
  const prefix = `tp_${raw.slice(3, 11)}`
  return { key: raw, prefix, hash: hashApiKey(raw) }
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

export function scopesToEnum(scopes: string[]): ApiKeyScope[] {
  return scopes.filter(isApiKeyScope)
}

export function scopesToStrings(scopes: readonly ApiKeyScope[]) {
  return [...scopes]
}
