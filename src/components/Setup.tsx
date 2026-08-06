"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/store"

export default function Setup() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || pw.length < 8) {
      setError("Name, email and a password of at least 8 characters are required")
      return
    }
    if (pw !== confirm) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password: pw }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(j?.error ?? "setup failed")
        return
      }
      await db.load()
      router.replace("/terminal")
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

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight" style={{ color: "#dde2ec" }}>
            TapIn
          </div>
          <div className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            FIRST-RUN SETUP · CREATE THE ADMIN ACCOUNT
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-80 rounded-xl p-6 flex flex-col gap-4"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          {(
            [
              ["name", "Name", "Admin Name", name, setName],
              ["email", "Email", "admin@school.edu", email, setEmail],
            ] as const
          ).map(([k, label, ph, val, set]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
                {label}
              </label>
              <input
                type={k === "email" ? "email" : "text"}
                value={val}
                onChange={(e) => {
                  set(e.target.value)
                  setError("")
                }}
                placeholder={ph}
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
                style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec", caretColor: "#00e5a0" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2e3540")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1e2530")}
              />
            </div>
          ))}

          {(
            [
              ["pw", "Password", "Minimum 8 characters", pw, setPw],
              ["confirm", "Confirm Password", "Repeat password", confirm, setConfirm],
            ] as const
          ).map(([k, label, ph, val, set]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
                {label}
              </label>
              <input
                type="password"
                value={val}
                onChange={(e) => {
                  set(e.target.value)
                  setError("")
                }}
                placeholder={ph}
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
            </div>
          ))}

          {error && (
            <div className="text-xs font-mono animate-slide-up" style={{ color: "#ff4d6a" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#00e5a0", color: "#0a0c0f", fontFamily: "'Outfit', sans-serif", opacity: loading ? 0.6 : 1 }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#00ffb3"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#00e5a0"
            }}
          >
            {loading ? "Creating…" : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  )
}
