"use client"

import { useState } from "react"
import { db } from "../store"
import { reader } from "../reader"

type Step = "input" | "submitting" | "success" | "error"

const REASON_MESSAGE: Record<string, string> = {
  student_not_found: "No student found with that ID — check the number and try again.",
  student_has_card: "This student already has a card linked — ask an admin to change it.",
  card_in_use: "This card is already linked to another student.",
}

// Kiosk self-enrollment: shown automatically when a tap comes back
// unrecognized (Terminal.tsx), so a new student can bind their own card's
// factory UID — no admin step needed, since the student record already
// exists (imported via roster CSV). See bindNewCard for why this can only
// bind, never overwrite, an existing card/student.
export default function CardBind({
  cardId,
  onClose,
}: {
  cardId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>("input")
  const [studentId, setStudentId] = useState("")
  const [message, setMessage] = useState("")

  async function submit() {
    if (!studentId.trim()) return
    setStep("submitting")
    const result = await db.bindCard(studentId.trim(), cardId)
    if (result.ok) {
      await reader.submitCardTap(cardId)
      setStep("success")
      setTimeout(onClose, 1200)
      return
    }
    setStep("error")
    setMessage(REASON_MESSAGE[result.reason] ?? "Couldn't link this card — try again.")
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "rgba(5,6,8,0.85)", zIndex: 50 }}
      onClick={step === "input" || step === "error" ? onClose : undefined}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold" style={{ color: "#dde2ec" }}>
            New Card Detected
          </div>
          {(step === "input" || step === "error") && (
            <button
              onClick={onClose}
              className="text-xs font-mono px-1"
              style={{ color: "#56627a" }}
            >
              cancel
            </button>
          )}
        </div>

        {(step === "input" || step === "submitting") && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              This card isn&apos;t linked to anyone yet. Enter your student ID to
              bind it.
            </div>
            <input
              autoFocus
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={step === "submitting"}
              inputMode="numeric"
              placeholder="student ID"
              className="mono text-center text-2xl tracking-[0.3em] rounded-xl outline-none"
              style={{
                width: 220,
                padding: "10px 0",
                background: "#181c22",
                border: "1px solid #1e2530",
                color: "#dde2ec",
                caretColor: "#00e5a0",
              }}
            />
            <button
              onClick={submit}
              disabled={step === "submitting" || !studentId.trim()}
              className="px-4 py-2 rounded-lg text-xs font-mono mt-1"
              style={{
                background: "rgba(0,229,160,0.12)",
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.3)",
                opacity: step === "submitting" || !studentId.trim() ? 0.5 : 1,
                cursor: step === "submitting" ? "wait" : "pointer",
              }}
            >
              {step === "submitting" ? "linking…" : "Link Card"}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="text-2xl font-semibold" style={{ color: "#00e5a0" }}>
              ✓
            </div>
            <div className="text-sm text-center" style={{ color: "#dde2ec" }}>
              Card linked — you&apos;re clocked in.
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
                onClick={() => setStep("input")}
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
