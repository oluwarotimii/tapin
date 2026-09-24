"use client"

import { useState } from "react"
import { db } from "../store"
import { useFingerprintBridgeConnected } from "../hooks"
import { bridgeCapture } from "../lib/fingerprintBridge"

type FingerprintOp = "enroll" | "remove"

const FINGER_OPTIONS = [
  "right_index",
  "right_thumb",
  "right_middle",
  "left_index",
  "left_thumb",
  "left_middle",
]

export default function Fingerprints() {
  const [op, setOp] = useState<FingerprintOp>("enroll")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [finger, setFinger] = useState(FINGER_OPTIONS[0])
  const [result, setResult] = useState<{
    kind: "success" | "error"
    message: string
    detail?: string
  } | null>(null)
  const [scanning, setScanning] = useState(false)
  const bridgeConnected = useFingerprintBridgeConnected()

  const students = db.getStudents().filter((s) => s.status === "active")
  const target = students.find((s) => s.studentId === selectedStudentId)
  // Removal is a plain DB operation — no scanner needed either way.
  const canRun = op === "remove" ? !!target : bridgeConnected && !!target

  async function scan() {
    if (!target || (op === "enroll" && !bridgeConnected)) {
      setResult({
        kind: "error",
        message: !target ? "No student selected" : "Fingerprint bridge not connected",
      })
      return
    }
    setScanning(true)
    setResult(null)

    if (op === "enroll") {
      const template = await bridgeCapture()
      if (!template) {
        setScanning(false)
        setResult({ kind: "error", message: "Capture failed — no scan received" })
        return
      }
      const ok = await db.enrollFingerprint(target.id, finger, template)
      setScanning(false)
      setResult(
        ok
          ? {
              kind: "success",
              message: "Fingerprint enrolled",
              detail: `${finger} → ${target.name} (${target.studentId})`,
            }
          : { kind: "error", message: "Enroll failed" },
      )
    } else {
      await db.removeFingerprint(target.id, finger)
      setScanning(false)
      setResult({
        kind: "success",
        message: "Fingerprint removed",
        detail: `${finger} · ${target.name} (${target.studentId})`,
      })
    }
  }

  const colors = { success: "#00e5a0", error: "#ff4d6a" }
  const resultColor = result ? colors[result.kind] : "#dde2ec"
  const enrolled = db.getStudents().filter((s) => (s.fingerprintCount ?? 0) > 0)

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Fingerprints
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            enroll · remove — Futronic FS80H via local bridge
          </p>
        </div>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: bridgeConnected
              ? "rgba(0,229,160,0.08)"
              : "rgba(255,77,106,0.08)",
            color: bridgeConnected ? "#00e5a0" : "#ff4d6a",
            border: `1px solid ${
              bridgeConnected ? "rgba(0,229,160,0.2)" : "rgba(255,77,106,0.2)"
            }`,
          }}
        >
          {bridgeConnected ? "BRIDGE ONLINE" : "BRIDGE NOT CONNECTED"}
        </span>
      </div>

      {/* Op selector */}
      <div
        className="flex rounded-lg p-1 mb-6 w-fit"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
      >
        {(["enroll", "remove"] as FingerprintOp[]).map((o) => (
          <button
            key={o}
            onClick={() => {
              setOp(o)
              setResult(null)
            }}
            className="px-5 py-1.5 rounded-md text-xs font-mono transition-all capitalize"
            style={{
              background: op === o ? "#1e2530" : "transparent",
              color: op === o ? "#dde2ec" : "#56627a",
            }}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Student picker */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: "#56627a" }}
          >
            Student
          </div>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
            style={{
              background: "#181c22",
              border: "1px solid #1e2530",
              color: selectedStudentId ? "#dde2ec" : "#56627a",
            }}
          >
            <option value="">— choose student —</option>
            {students.map((s) => (
              <option key={s.id} value={s.studentId}>
                {s.name} · {s.studentId}
                {s.fingerprintCount ? ` (${s.fingerprintCount} enrolled)` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Finger picker */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: "#56627a" }}
          >
            Finger
          </div>
          <select
            value={finger}
            onChange={(e) => setFinger(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
            style={{
              background: "#181c22",
              border: "1px solid #1e2530",
              color: "#dde2ec",
            }}
          >
            {FINGER_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Scan button */}
        <div className="flex items-center gap-4">
          <button
            onClick={scan}
            disabled={scanning || !canRun}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-mono transition-all"
            style={{
              background: !canRun
                ? "rgba(46,53,64,0.3)"
                : op === "remove"
                  ? "rgba(255,77,106,0.12)"
                  : "rgba(0,229,160,0.12)",
              color: !canRun
                ? "#2e3a4e"
                : op === "remove"
                  ? "#ff4d6a"
                  : "#00e5a0",
              border: `1px solid ${
                !canRun
                  ? "#1e2530"
                  : op === "remove"
                    ? "rgba(255,77,106,0.3)"
                    : "rgba(0,229,160,0.3)"
              }`,
              cursor: scanning ? "wait" : !canRun ? "not-allowed" : "pointer",
            }}
          >
            {scanning
              ? "scanning…"
              : op === "enroll"
                ? "Scan Fingerprint"
                : "Remove Fingerprint"}
          </button>
          <span className="text-xs font-mono" style={{ color: "#2e3540" }}>
            {!target
              ? "choose a student first"
              : op === "enroll" && !bridgeConnected
                ? "fingerprint bridge not connected"
                : "applies to this student now"}
          </span>
        </div>

        {/* Result */}
        {result && (
          <div
            className="rounded-xl p-4 animate-slide-up"
            style={{
              background: `${resultColor}0d`,
              border: `1px solid ${resultColor}30`,
            }}
          >
            <div
              className="text-sm font-semibold mb-1"
              style={{ color: resultColor }}
            >
              {result.message}
            </div>
            {result.detail && (
              <div className="text-xs font-mono" style={{ color: "#56627a" }}>
                {result.detail}
              </div>
            )}
          </div>
        )}

        {/* Directory */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid #1e2530" }}
        >
          <div
            className="px-4 py-2.5"
            style={{ background: "#111418", borderBottom: "1px solid #1e2530" }}
          >
            <span
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: "#56627a" }}
            >
              Enrolled Students
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2530" }}>
                <th
                  className="text-left px-4 py-2 text-xs font-mono"
                  style={{ color: "#2e3a4e" }}
                >
                  Student
                </th>
                <th
                  className="text-left px-4 py-2 text-xs font-mono"
                  style={{ color: "#2e3a4e" }}
                >
                  Enrolled prints
                </th>
              </tr>
            </thead>
            <tbody>
              {enrolled.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      i < enrolled.length - 1 ? "1px solid #1e2530" : "none",
                    background: "#0d1015",
                  }}
                >
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#dde2ec" }}>
                    {s.name}{" "}
                    <span className="font-mono" style={{ color: "#56627a" }}>
                      · {s.studentId}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2.5 text-xs font-mono"
                    style={{ color: "#00e5a0" }}
                  >
                    {s.fingerprintCount}
                  </td>
                </tr>
              ))}
              {enrolled.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center py-6 text-xs font-mono"
                    style={{ color: "#2e3540" }}
                  >
                    no fingerprints enrolled
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
