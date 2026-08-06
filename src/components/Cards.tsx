import { useState } from "react"
import { db, generateCardId } from "../store"
import { reader } from "../reader"
import { useReaderStatus } from "../hooks"

type CardOp = "write" | "read" | "blank"

export default function Cards() {
  const [op, setOp] = useState<CardOp>("write")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [simulatedCardId, setSimulatedCardId] = useState(generateCardId())
  const [result, setResult] = useState<{
    kind: "success" | "error" | "info"
    message: string
    detail?: string
  } | null>(null)
  const [scanning, setScanning] = useState(false)
  const readerStatus = useReaderStatus()

  const students = db.getStudents().filter((s) => s.status === "active")
  const online = readerStatus === "connected"

  function simulate() {
    if (!online) return
    setScanning(true)
    setResult(null)
    if (op === "write") {
      const student = students.find((s) => s.studentId === selectedStudentId)
      if (!student) {
        setScanning(false)
        setResult({
          kind: "error",
          message: "No student selected",
          detail: "Choose a student from the list",
        })
        return
      }
      reader.writeCard(simulatedCardId, student.studentId).then((ok) => {
        setScanning(false)
        if (ok) {
          setResult({
            kind: "success",
            message: "Card written",
            detail: `${simulatedCardId} → ${student.name} (${student.studentId})`,
          })
          setSimulatedCardId(generateCardId())
        } else {
          setResult({
            kind: "error",
            message: "Write failed",
            detail: "Student not found",
          })
        }
      })
    } else if (op === "read") {
      reader.readCard(simulatedCardId).then(({ student, isTapIn }) => {
        setScanning(false)
        if (!isTapIn) {
          setResult({
            kind: "error",
            message: "Not a TapIn card",
            detail: simulatedCardId,
          })
        } else if (student) {
          setResult({
            kind: "info",
            message: "Card recognized",
            detail: `${simulatedCardId} → ${student.name} (${student.studentId}) · ${student.status}`,
          })
        } else {
          setResult({
            kind: "error",
            message: "Card not linked",
            detail: `${simulatedCardId} has no student assigned`,
          })
        }
      })
    } else {
      reader.blankCard(simulatedCardId).then(() => {
        setScanning(false)
        setResult({
          kind: "success",
          message: "Card blanked",
          detail: `${simulatedCardId} is now reusable`,
        })
        setSimulatedCardId(generateCardId())
      })
    }
  }

  const colors = { success: "#00e5a0", error: "#ff4d6a", info: "#4d9fff" }
  const resultColor = result ? colors[result.kind] : "#dde2ec"

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Cards
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            write · read · blank — simulated reader
          </p>
        </div>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: online
              ? "rgba(0,229,160,0.08)"
              : "rgba(255,77,106,0.08)",
            color: online ? "#00e5a0" : "#ff4d6a",
            border: `1px solid ${
              online ? "rgba(0,229,160,0.2)" : "rgba(255,77,106,0.2)"
            }`,
          }}
        >
          {online ? "READER ONLINE" : "READER OFFLINE"}
        </span>
      </div>

      {/* Op selector */}
      <div
        className="flex rounded-lg p-1 mb-6 w-fit"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
      >
        {(["write", "read", "blank"] as CardOp[]).map((o) => (
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
        {/* Simulated card */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: "#56627a" }}
          >
            Simulated Card
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "#181c22", border: "1px solid #1e2530" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect
                  x="1.5"
                  y="4"
                  width="15"
                  height="10"
                  rx="1.75"
                  stroke="#56627a"
                  strokeWidth="1.25"
                />
                <rect
                  x="3"
                  y="6"
                  width="4"
                  height="3.5"
                  rx="0.5"
                  stroke="#56627a"
                  strokeWidth="1"
                />
                <line
                  x1="9"
                  y1="7"
                  x2="14"
                  y2="7"
                  stroke="#56627a"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                <line
                  x1="9"
                  y1="9"
                  x2="12"
                  y2="9"
                  stroke="#56627a"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="text"
                value={simulatedCardId}
                onChange={(e) =>
                  setSimulatedCardId(e.target.value.toUpperCase())
                }
                className="flex-1 text-sm font-mono outline-none bg-transparent"
                style={{ color: "#dde2ec", caretColor: "#00e5a0" }}
              />
            </div>
            <button
              onClick={() => setSimulatedCardId(generateCardId())}
              className="text-xs font-mono px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: "#181c22",
                border: "1px solid #1e2530",
                color: "#56627a",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#dde2ec")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#56627a")}
            >
              new id
            </button>
          </div>
        </div>

        {/* Write: student picker */}
        {op === "write" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "#56627a" }}
            >
              Link to Student
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
                  {s.cardId ? " (has card)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Read info */}
        {op === "read" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: "#56627a" }}
            >
              What Read does
            </div>
            <p
              className="text-xs font-mono"
              style={{ color: "#56627a", lineHeight: 1.7 }}
            >
              Checks if the card has a TapIn marker and shows the linked student
              (if any).
            </p>
          </div>
        )}

        {/* Blank info */}
        {op === "blank" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "#111418", border: "1px solid #ff4d6a30" }}
          >
            <div
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: "#ff4d6a" }}
            >
              Destructive Operation
            </div>
            <p
              className="text-xs font-mono"
              style={{ color: "#56627a", lineHeight: 1.7 }}
            >
              Wipes the card ID — the card is unlinked from any student. The
              card can then be reused for a different student.
            </p>
          </div>
        )}

        {/* Tap button */}
        <div className="flex items-center gap-4">
          <button
            onClick={simulate}
            disabled={scanning || !online}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-mono transition-all"
            style={{
              background: !online
                ? "rgba(46,53,64,0.3)"
                : op === "blank"
                  ? "rgba(255,77,106,0.12)"
                  : "rgba(0,229,160,0.12)",
              color: !online
                ? "#2e3a4e"
                : op === "blank"
                  ? "#ff4d6a"
                  : "#00e5a0",
              border: `1px solid ${
                !online
                  ? "#1e2530"
                  : op === "blank"
                    ? "rgba(255,77,106,0.3)"
                    : "rgba(0,229,160,0.3)"
              }`,
              cursor: scanning ? "wait" : !online ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                scanning…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect
                    x="1"
                    y="1"
                    width="5"
                    height="5"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <rect
                    x="10"
                    y="1"
                    width="5"
                    height="5"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    opacity="0.5"
                  />
                  <rect
                    x="1"
                    y="10"
                    width="5"
                    height="5"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    opacity="0.5"
                  />
                  <rect
                    x="12"
                    y="12"
                    width="2"
                    height="2"
                    rx="0.25"
                    fill="currentColor"
                  />
                  <rect
                    x="10"
                    y="10"
                    width="2"
                    height="2"
                    rx="0.25"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
                {op === "write"
                  ? "Write Card"
                  : op === "read"
                    ? "Read Card"
                    : "Blank Card"}
              </>
            )}
          </button>
          <span className="text-xs font-mono" style={{ color: "#2e3540" }}>
            {online
              ? "simulates placing card on reader"
              : "reader offline — connect a device"}
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

        {/* Linked cards list */}
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
              Card Directory
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2530" }}>
                <th
                  className="text-left px-4 py-2 text-xs font-mono"
                  style={{ color: "#2e3a4e" }}
                >
                  Card ID
                </th>
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {db
                .getStudents()
                .filter((s) => s.cardId)
                .map((s, i, arr) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom:
                        i < arr.length - 1 ? "1px solid #1e2530" : "none",
                      background: "#0d1015",
                    }}
                  >
                    <td
                      className="px-4 py-2.5 text-xs font-mono"
                      style={{ color: "#00e5a0" }}
                    >
                      {s.cardId}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: "#dde2ec" }}
                    >
                      {s.name}{" "}
                      <span className="font-mono" style={{ color: "#56627a" }}>
                        · {s.studentId}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            s.status === "active"
                              ? "rgba(0,229,160,0.1)"
                              : "rgba(46,53,64,0.5)",
                          color: s.status === "active" ? "#00e5a0" : "#56627a",
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              {db.getStudents().filter((s) => s.cardId).length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center py-6 text-xs font-mono"
                    style={{ color: "#2e3540" }}
                  >
                    no cards linked
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
