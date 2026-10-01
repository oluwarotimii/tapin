"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"

type Settings = {
  cardEnabled: boolean
  fingerprintEnabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    cardEnabled: true,
    fingerprintEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const s = await api<Settings>("/api/v1/settings")
      setSettings(s)
    } catch {
      setMessage({ text: "Failed to load settings", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  async function toggleSetting(key: keyof Settings, value: boolean) {
    setSaving(key)
    try {
      await api("/api/v1/settings", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      })
      setSettings((prev) => ({ ...prev, [key]: value }))
      setMessage({ text: `${key} ${value ? "enabled" : "disabled"}`, type: "success" })
    } catch {
      setMessage({ text: "Failed to save setting", type: "error" })
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent w-8 h-8" />
      </div>
    )
  }

  const items: { key: keyof Settings; label: string; description: string; icon: React.ReactNode }[] = [
    {
      key: "cardEnabled",
      label: "RFID Card Tap",
      description: "Students tap RFID card to clock in/out instantly",
      icon: (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="4" width="13" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
          <rect x="3" y="5.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <line x1="8" y1="6.5" x2="12.5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "fingerprintEnabled",
      label: "Fingerprint Verification",
      description: "Students type 4-digit ID then scan fingerprint to verify",
      icon: (
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
          <path d="M9 2.5a6 6 0 0 1 6 6v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5.2 5.8A4 4 0 0 0 5 8.5v2a5 5 0 0 0 1.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "#dde2ec" }}>Terminal Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#56627a" }}>
          Enable or disable authentication methods for the kiosk. Changes apply immediately.
        </p>
      </div>

      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: message.type === "success" ? "rgba(0,229,160,0.1)" : "rgba(255,77,106,0.1)",
            border: `1px solid ${message.type === "success" ? "rgba(0,229,160,0.3)" : "rgba(255,77,106,0.3)"}`,
            color: message.type === "success" ? "#00e5a0" : "#ff4d6a",
          }}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.2)" }}
              >
                {item.icon}
              </div>
              <div>
                <div className="font-medium" style={{ color: "#dde2ec" }}>{item.label}</div>
                <div className="text-sm mt-0.5" style={{ color: "#56627a" }}>{item.description}</div>
              </div>
            </div>
            <button
              onClick={() => toggleSetting(item.key, !settings[item.key])}
              disabled={saving === item.key}
              className="relative w-14 h-8 rounded-full transition-all flex items-center px-1"
              style={{
                background: settings[item.key] ? "rgba(0,229,160,0.3)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${settings[item.key] ? "rgba(0,229,160,0.5)" : "rgba(255,255,255,0.1)"}`,
              }}
              role="switch"
              aria-checked={settings[item.key]}
            >
              <span
                className="w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200"
                style={{
                  transform: settings[item.key] ? "translateX(100%)" : "translateX(0)",
                }}
              />
              {saving === item.key && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#00e5a0] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t" style={{ borderColor: "#1e2530" }}>
        <h2 className="font-medium mb-3" style={{ color: "#dde2ec" }}>Current Terminal Behavior</h2>
        <div className="space-y-2 text-sm" style={{ color: "#56627a" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: settings.cardEnabled ? "#00e5a0" : "#2e3540" }} />
            <span>Card tap: {settings.cardEnabled ? "Enabled — tap card to clock in" : "Disabled"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: settings.fingerprintEnabled ? "#00e5a0" : "#2e3540" }} />
            <span>
              Fingerprint: {settings.fingerprintEnabled ? "Enabled — type ID + scan finger" : "Disabled"}
            </span>
          </div>
          {!settings.cardEnabled && !settings.fingerprintEnabled && (
            <div className="text-xs text-amber-400 mt-2">
              ⚠ Both methods disabled — terminal will not accept any taps
            </div>
          )}
        </div>
      </div>
    </div>
  )
}