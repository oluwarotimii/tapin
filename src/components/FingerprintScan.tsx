"use client"

import { useEffect, useRef, useState } from "react"
import { reader } from "../reader"
import type { Student } from "../lib/types"
import { verifyAndTapFingerprint } from "../lib/fingerprintBridge"

type Step = "scanning" | "success" | "error"

const SCAN_WINDOW_SECONDS = 30

// Tap-time fingerprint check for the kiosk. The caller has already resolved
// which student this is (Terminal.tsx's 4-digit code entry) — this just scans
// and verifies it's them (1:1), not "place your finger and we'll guess who
// you are" — see src/server/fingerprintMatch.ts.
//
// One round-trip: capture → POST /api/v1/fingerprint/verify-and-tap, which
// verifies AND writes the attendance tap server-side. On a match we feed the
// returned tap result straight into the same tap-event stream as a card tap,
// so Terminal's own status display shows the clock-in/out result.
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
    setMessage("")
    setSecondsLeft(SCAN_WINDOW_SECONDS)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 1))
    }, 1000)

    const { outcome, tap } = await verifyAndTapFingerprint(student.studentId)
    if (countdownRef.current) clearInterval(countdownRef.current)

    if (outcome === "matched") {
      if (tap) {
        reader.emitVerifiedFingerprintTap(student.studentId, tap)
      } else {
        // Defensive fallback — verification passed but no tap payload came
        // back; perform the tap through the normal path.
        await reader.submitFingerprintTap(student.studentId)
      }
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
      setMessage(
        "Scan failed or timed out — place your finger fully on the reader and try again",
      )
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "rgba(5,6,8,0.88)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid #1e2530" }}
        >
          <div className="text-sm font-semibold" style={{ color: "#dde2ec" }}>
            Fingerprint Check
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono px-1 transition-colors"
            style={{ color: "#56627a" }}
          >
            cancel
          </button>
        </div>

        <div className="flex flex-col items-center px-6 py-8">
          {/* Centered status icon */}
          <div className="relative flex items-center justify-center mb-5">
            {step === "scanning" && (
              <span
                className="absolute rounded-full animate-ping"
                style={{
                  width: 112,
                  height: 112,
                  background: "rgba(0,229,160,0.08)",
                }}
              />
            )}
            <div
              className="relative rounded-full flex items-center justify-center"
              style={{
                width: 96,
                height: 96,
                background:
                  step === "error"
                    ? "rgba(255,77,106,0.08)"
                    : "rgba(0,229,160,0.08)",
                border: `1.5px solid ${
                  step === "error"
                    ? "rgba(255,77,106,0.35)"
                    : "rgba(0,229,160,0.35)"
                }`,
              }}
            >
              {step === "scanning" && (
                <svg
                  className="animate-pulse"
                  width="44"
                  height="44"
                  viewBox="0 0 18 18"
                  fill="none"
                >
                  <path d="M9 2.5a6 6 0 0 1 6 6v1.5" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 4.5a4 4 0 0 1 4 4v2" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 9a6 6 0 0 1 2.5-4.9" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M5.2 5.8A4 4 0 0 0 5 8.5v2a5 5 0 0 0 1.2 3.2" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              {step === "success" && (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="#00e5a0"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {step === "error" && (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 7v6M12 16.5v.5"
                    stroke="#ff4d6a"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </div>

          {step === "scanning" && (
            <>
              <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
                Place your finger on the reader
              </div>
              <div
                className="text-sm font-semibold text-center mt-1"
                style={{ color: "#00e5a0" }}
              >
                {student.name}
              </div>
              <div
                className="mt-4 mono text-xs px-3 py-1 rounded-full"
                style={{
                  color: "#56627a",
                  background: "#181c22",
                  border: "1px solid #1e2530",
                }}
              >
                {secondsLeft}s remaining
              </div>
            </>
          )}

          {step === "success" && (
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              {message}
            </div>
          )}

          {step === "error" && (
            <>
              <div
                className="text-sm text-center leading-relaxed"
                style={{ color: "#ff8a9c" }}
              >
                {message}
              </div>
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={scan}
                  className="px-4 py-2 rounded-lg text-xs font-mono transition-colors"
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
                  className="text-xs font-mono px-2"
                  style={{ color: "#56627a" }}
                >
                  cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}