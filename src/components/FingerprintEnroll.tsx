"use client"

import { useState } from "react"
import { db } from "../store"
import type { Student } from "../lib/types"
import { bridgeCapture } from "../lib/fingerprintBridge"

type Step = "search" | "confirm" | "scanning" | "success" | "error"

// Self-service enrollment for the public kiosk: a student searches for
// their own name, confirms, and scans their thumb once. No admin needed.
export default function FingerprintEnroll({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Student | null>(null)
  const [step, setStep] = useState<Step>("search")
  const [message, setMessage] = useState("")

  const students = db.getStudents().filter((s) => s.status === "active")
  const q = query.trim().toLowerCase()
  const results =
    q.length >= 2
      ? students
          .filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.studentId.toLowerCase().includes(q),
          )
          .slice(0, 8)
      : []

  function pick(s: Student) {
    setSelected(s)
    setStep("confirm")
    setMessage("")
  }

  async function scan() {
    if (!selected) return
    setStep("scanning")
    const template = await bridgeCapture()
    if (!template) {
      setStep("error")
      setMessage("Scan failed — place your thumb fully on the reader and try again")
      return
    }
    const ok = await db.enrollFingerprint(selected.id, "thumb", template)
    if (!ok) {
      setStep("error")
      setMessage("Could not save — try again")
      return
    }
    setStep("success")
    setMessage(`Saved for ${selected.name}`)
    setTimeout(onClose, 1800)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "rgba(5,6,8,0.85)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold" style={{ color: "#dde2ec" }}>
            Enroll Fingerprint
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono px-1"
            style={{ color: "#56627a" }}
          >
            close
          </button>
        </div>

        {step === "search" && (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your name or student ID…"
              className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none mb-3"
              style={{
                background: "#181c22",
                border: "1px solid #1e2530",
                color: "#dde2ec",
                caretColor: "#00e5a0",
              }}
            />
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {q.length < 2 ? (
                <div
                  className="text-xs font-mono py-4 text-center"
                  style={{ color: "#2e3540" }}
                >
                  keep typing…
                </div>
              ) : results.length === 0 ? (
                <div
                  className="text-xs font-mono py-4 text-center"
                  style={{ color: "#2e3540" }}
                >
                  no match
                </div>
              ) : (
                results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pick(s)}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{ background: "#181c22", color: "#dde2ec" }}
                  >
                    {s.name}{" "}
                    <span className="font-mono text-xs" style={{ color: "#56627a" }}>
                      · {s.studentId}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {step === "confirm" && selected && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              Enrolling <span style={{ color: "#00e5a0" }}>{selected.name}</span>
            </div>
            <div
              className="text-xs font-mono text-center"
              style={{ color: "#56627a" }}
            >
              Place your thumb on the reader when ready
            </div>
            <button
              onClick={scan}
              className="px-5 py-2.5 rounded-lg text-sm font-mono"
              style={{
                background: "rgba(0,229,160,0.12)",
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.3)",
              }}
            >
              Scan Thumb
            </button>
            <button
              onClick={() => {
                setSelected(null)
                setStep("search")
              }}
              className="text-xs font-mono"
              style={{ color: "#56627a" }}
            >
              not you? search again
            </button>
          </div>
        )}

        {step === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <svg
              className="animate-spin"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="#2e3540" strokeWidth="2" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="#00e5a0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <div className="text-sm" style={{ color: "#dde2ec" }}>
              Scanning…
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="text-2xl font-semibold" style={{ color: "#00e5a0" }}>
              ✓
            </div>
            <div className="text-sm" style={{ color: "#dde2ec" }}>
              {message}
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-sm text-center" style={{ color: "#ff4d6a" }}>
              {message}
            </div>
            <button
              onClick={scan}
              className="px-4 py-2 rounded-lg text-xs font-mono"
              style={{
                background: "rgba(255,77,106,0.12)",
                color: "#ff4d6a",
                border: "1px solid rgba(255,77,106,0.3)",
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
