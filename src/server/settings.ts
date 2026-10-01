import "server-only"
import { prisma } from "@/lib/db"

export type AppSettings = {
  cardEnabled: boolean
  fingerprintEnabled: boolean
}

const DEFAULTS: AppSettings = {
  cardEnabled: true,
  fingerprintEnabled: true,
}

const SETTING_KEYS = {
  cardEnabled: "card_enabled",
  fingerprintEnabled: "fingerprint_enabled",
} as const

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    cardEnabled: map.get(SETTING_KEYS.cardEnabled) === "true",
    fingerprintEnabled: map.get(SETTING_KEYS.fingerprintEnabled) === "true",
  }
}

export async function setAppSetting(key: keyof AppSettings, value: boolean) {
  const dbKey = SETTING_KEYS[key]
  await prisma.appSetting.upsert({
    where: { key: dbKey },
    create: { key: dbKey, value: String(value) },
    update: { value: String(value) },
  })
}

export async function initializeDefaults() {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const dbKey = SETTING_KEYS[k as keyof AppSettings]
    await prisma.appSetting.upsert({
      where: { key: dbKey },
      create: { key: dbKey, value: String(v) },
      update: {},
    })
  }
}