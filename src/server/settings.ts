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
  // A key with no row yet (fresh DB, never toggled) must fall back to
  // DEFAULTS, not false — otherwise the terminal silently starts with
  // every method disabled until someone happens to visit the settings page.
  return {
    cardEnabled: map.has(SETTING_KEYS.cardEnabled)
      ? map.get(SETTING_KEYS.cardEnabled) === "true"
      : DEFAULTS.cardEnabled,
    fingerprintEnabled: map.has(SETTING_KEYS.fingerprintEnabled)
      ? map.get(SETTING_KEYS.fingerprintEnabled) === "true"
      : DEFAULTS.fingerprintEnabled,
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