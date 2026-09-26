"use client"

import { useEffect, useRef, useState } from "react"
import { reader } from "../reader"
import type { Student } from "../lib/types"
import { verifyFingerprint } from "../lib/fingerprintBridge"

type Step = "scanning" | "success" | "error"

const SCAN_WINDOW_SECONDS = 30

// Tap-time fingerprint check for the kiosk. The caller has already
// resolved which student this is (Terminal.tsx's 4-digit code entry) — this
// just scans and verifies it's them (1:1), not "place your finger and
// we'll guess who you are" — see src/server/fingerprintMatch.ts for why.
// On a match this feeds the same tap pipeline as a card tap; Terminal's own
// status display shows the clock-in/out result, so this modal just closes.
export default function FingerprintScan({
  student,
  onClose,
}: {
  student: Student
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>("scanning")
  const [message, setMessage] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(SCAN_WINDOW_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    scan()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function scan() {
    setStep("scanning")
    setSecondsLeft(SCAN_WINDOW_SECONDS)
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 1))
    }, 1000)

    const outcome = await verifyFingerprint(student.studentId)
    if (countdownRef.current) clearInterval(countdownRef.current)

    if (outcome === "matched") {
      await reader.submitFingerprintTap(student.studentId)
      setStep("success")
      setMessage(`Verified — welcome, ${student.name}`)
      setTimeout(onClose, 1200)
      return
    }

    setStep("error")
    if (outcome === "not_enrolled") {
      setMessage(
        `${student.name} has no fingerprint enrolled yet — use "Enroll Fingerprint" first`,
      )
    } else if (outcome === "no_match") {
      setMessage("Fingerprint didn't match — try again, or use your card instead")
    } else {
      setMessage("Scan failed or timed out — place your finger fully on the reader and try again")
    }
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
            Fingerprint Check
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono px-1"
            style={{ color: "#56627a" }}
          >
            cancel
          </button>
        </div>

        {step === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <svg
              className="animate-pulse"
              width="36"
              height="36"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M9 2.5a6 6 0 0 1 6 6v1.5"
                stroke="#00e5a0"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M9 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3"
                stroke="#00e5a0"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M5.2 5.8A4 4 0 0 0 5 8.5v2a5 5 0 0 0 1.2 3.2"
                stroke="#00e5a0"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M3 9a6 6 0 0 1 2.5-4.9"
                stroke="#00e5a0"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              Place your finger on the reader,{" "}
              <span style={{ color: "#00e5a0" }}>{student.name}</span>
            </div>
            <div className="text-xs font-mono" style={{ color: "#56627a" }}>
              {secondsLeft}s remaining
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="text-2xl font-semibold" style={{ color: "#00e5a0" }}>
              ✓
            </div>
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              {message}
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-sm text-center" style={{ color: "#ff4d6a" }}>
              {message}
            </div>
            <div className="flex items-center gap-3">
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
              <button
                onClick={onClose}
                className="text-xs font-mono"
                style={{ color: "#56627a" }}
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
