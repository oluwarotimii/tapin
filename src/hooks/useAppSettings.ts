"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export type AppSettings = {
  cardEnabled: boolean
  fingerprintEnabled: boolean
}

const DEFAULTS: AppSettings = {
  cardEnabled: true,
  fingerprintEnabled: true,
}

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    api<AppSettings>("/api/v1/settings")
      .then((s) => mounted && setSettings(s))
      .catch(() => mounted && setSettings(DEFAULTS))
      .finally(() => mounted && setLoaded(true))
    return () => { mounted = false }
  }, [])

  return settings
}