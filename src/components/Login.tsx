"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/store"

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !pw) {
      setError("Email and password are required")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pw }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(j?.error ?? "login failed")
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPw("")
        return
      }
      await db.load()
      router.replace("/admin")
    } catch {
      setError("network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#0a0c0f" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,37,48,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,37,48,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(0,229,160,0.12)",
              border: "1px solid rgba(0,229,160,0.3)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="#00e5a0" />
              <rect x="16" y="4" width="8" height="8" rx="1.5" fill="#00e5a0" opacity="0.4" />
              <rect x="4" y="16" width="8" height="8" rx="1.5" fill="#00e5a0" opacity="0.4" />
              <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#00e5a0" opacity="0.7" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold tracking-tight" style={{ color: "#dde2ec" }}>
              TapIn
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
              SOLO ATTENDANCE SYSTEM
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`w-80 rounded-xl p-6 flex flex-col gap-4 ${shake ? "animate-[wiggle_0.4s_ease-in-out]" : ""}`}
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            transform: shake ? undefined : "none",
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError("")
              }}
              placeholder="admin@school.edu"
              autoComplete="email"
              className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
              style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec", caretColor: "#00e5a0" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#2e3540")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e2530")}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
              Password
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value)
                setError("")
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
              style={{
                background: "#181c22",
                border: `1px solid ${error ? "#ff4d6a" : "#1e2530"}`,
                color: "#dde2ec",
                caretColor: "#00e5a0",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = error ? "#ff4d6a" : "#2e3540")}
              onBlur={(e) => (e.currentTarget.style.borderColor = error ? "#ff4d6a" : "#1e2530")}
            />
            {error && (
              <div className="text-xs font-mono animate-slide-up" style={{ color: "#ff4d6a" }}>
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "#00e5a0",
              color: "#0a0c0f",
              fontFamily: "'Outfit', sans-serif",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#00ffb3"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#00e5a0"
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="text-xs font-mono" style={{ color: "#2e3540" }}>
          v2 · server-backed
        </div>
      </div>
    </div>
  )
}
