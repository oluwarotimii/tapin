import { useState, useMemo } from "react"
import { db, type AttendanceRecord } from "../store"

type Filter = "all" | "complete" | "incomplete" | "in_progress"

export default function AttendanceLog() {
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    db.getAttendance(),
  )
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [exportMsg, setExportMsg] = useState("")
  const [viewStudent, setViewStudent] = useState<string | null>(null)

  function refresh() {
    setRecords([...db.getAttendance()])
  }

  const filtered = useMemo(() => {
    return records
      .filter((r) => filter === "all" || r.status === filter)
      .filter(
        (r) =>
          !search ||
          r.studentName.toLowerCase().includes(search.toLowerCase()) ||
          r.studentId.includes(search),
      )
      .filter((r) => !dateFrom || r.date >= dateFrom)
      .filter((r) => !dateTo || r.date <= dateTo)
      .sort((a, b) => (a.date + a.clockIn < b.date + b.clockIn ? 1 : -1))
  }, [records, filter, search, dateFrom, dateTo])

  function handleExport() {
    const csv = db.exportAttendanceCSV()
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportMsg("Exported!")
    setTimeout(() => setExportMsg(""), 2000)
  }

  const studentRecords = useMemo(() => {
    if (!viewStudent) return []
    return records
      .filter((r) => r.studentId === viewStudent)
      .sort((a, b) => (a.date + a.clockIn < b.date + b.clockIn ? 1 : -1))
  }, [records, viewStudent])

  const studentSummary = useMemo(() => {
    const total = studentRecords.length
    const withDuration = studentRecords.filter((r) => r.durationMinutes != null)
    const avg =
      withDuration.length > 0
        ? Math.round(
            withDuration.reduce((acc, r) => acc + (r.durationMinutes ?? 0), 0) /
              withDuration.length,
          )
        : null
    return {
      total,
      complete: studentRecords.filter((r) => r.status === "complete").length,
      incomplete: studentRecords.filter((r) => r.status === "incomplete")
        .length,
      avg,
    }
  }, [studentRecords])

  const counts = useMemo(() => {
    const all = records
    return {
      all: all.length,
      complete: all.filter((r) => r.status === "complete").length,
      incomplete: all.filter((r) => r.status === "incomplete").length,
      in_progress: all.filter((r) => r.status === "in_progress").length,
    }
  }, [records])

  const statusColors: Record<string, string> = {
    complete: "#00e5a0",
    incomplete: "#ffb03a",
    in_progress: "#4d9fff",
  }

  const statusLabels: Record<string, string> = {
    complete: "complete",
    incomplete: "incomplete",
    in_progress: "in progress",
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Attendance Log
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            {counts.complete} complete · {counts.incomplete} incomplete ·{" "}
            {counts.in_progress} in progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportMsg && (
            <span
              className="text-xs font-mono px-2 py-1 rounded animate-fade-in"
              style={{ color: "#00e5a0", background: "rgba(0,229,160,0.1)" }}
            >
              {exportMsg}
            </span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded transition-all"
            style={{
              background: "#181c22",
              color: "#56627a",
              border: "1px solid #1e2530",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#dde2ec"
              e.currentTarget.style.borderColor = "#2e3540"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#56627a"
              e.currentTarget.style.borderColor = "#1e2530"
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v8m0 0L5 7m3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Export CSV
          </button>
          <button
            onClick={refresh}
            className="text-xs font-mono px-3 py-1.5 rounded transition-all"
            style={{
              background: "#181c22",
              color: "#56627a",
              border: "1px solid #1e2530",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#dde2ec")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#56627a")}
          >
            refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Status tabs */}
        <div
          className="flex rounded-lg p-1"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          {(["all", "complete", "incomplete", "in_progress"] as Filter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-md text-xs font-mono transition-all capitalize"
                style={{
                  background: filter === f ? "#1e2530" : "transparent",
                  color: filter === f ? "#dde2ec" : "#56627a",
                }}
              >
                {f === "in_progress" ? "active" : f}
                <span className="ml-1.5 opacity-60">{counts[f]}</span>
              </button>
            ),
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            color: "#dde2ec",
            caretColor: "#00e5a0",
          }}
        />

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            color: dateFrom ? "#dde2ec" : "#56627a",
          }}
        />
        <span className="text-xs font-mono" style={{ color: "#2e3540" }}>
          →
        </span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            color: dateTo ? "#dde2ec" : "#56627a",
          }}
        />
        {(dateFrom || dateTo || search) && (
          <button
            onClick={() => {
              setDateFrom("")
              setDateTo("")
              setSearch("")
            }}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ color: "#56627a", border: "1px solid #1e2530" }}
          >
            clear
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #1e2530" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                background: "#111418",
                borderBottom: "1px solid #1e2530",
              }}
            >
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Date
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Student
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Clock In
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Clock Out
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Duration
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-xs font-mono"
                  style={{ color: "#2e3540" }}
                >
                  no records match filter
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? "1px solid #1e2530" : "none",
                    background: "#0d1015",
                  }}
                >
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "#56627a" }}
                  >
                    {r.date}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewStudent(r.studentId)}
                      className="text-left transition-all"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#00e5a0")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "inherit")
                      }
                    >
                      <div style={{ color: "#dde2ec" }}>{r.studentName}</div>
                      <div
                        className="text-xs font-mono"
                        style={{ color: "#2e3a4e" }}
                      >
                        {r.studentId}
                      </div>
                    </button>
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-sm"
                    style={{ color: "#dde2ec" }}
                  >
                    {r.clockIn}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-sm"
                    style={{ color: r.clockOut ? "#dde2ec" : "#2e3540" }}
                  >
                    {r.clockOut ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-sm"
                    style={{
                      color: r.durationMinutes != null ? "#dde2ec" : "#2e3540",
                    }}
                  >
                    {r.durationMinutes != null ? `${r.durationMinutes}m` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{
                        background: `${statusColors[r.status]}15`,
                        color: statusColors[r.status] ?? "#56627a",
                        border: `1px solid ${statusColors[r.status]}30`,
                      }}
                    >
                      {statusLabels[r.status] ?? r.status}
                    </span>
                    {r.override && (
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded ml-1.5"
                        style={{
                          background: "#ffb03a15",
                          color: "#ffb03a",
                          border: "1px solid #ffb03a30",
                        }}
                      >
                        OVR
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 text-xs font-mono" style={{ color: "#2e3540" }}>
          showing {filtered.length} of {records.length} records
        </div>
      )}

      {/* Per-student history modal */}
      {viewStudent && studentRecords.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10,12,15,0.85)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewStudent(null)
          }}
        >
          <div
            className="w-[640px] max-w-[90vw] rounded-xl flex flex-col animate-slide-up"
            style={{
              background: "#111418",
              border: "1px solid #1e2530",
              maxHeight: "80vh",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #1e2530" }}
            >
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#dde2ec" }}
                >
                  {studentRecords[0].studentName}
                </div>
                <div className="text-xs font-mono" style={{ color: "#56627a" }}>
                  {studentRecords[0].studentId} · {studentSummary.total}{" "}
                  session(s)
                </div>
              </div>
              <button
                onClick={() => setViewStudent(null)}
                style={{ color: "#56627a" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <line
                    x1="4"
                    y1="4"
                    x2="12"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="4"
                    x2="4"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div
              className="grid grid-cols-3 gap-2 px-5 py-3"
              style={{ borderBottom: "1px solid #1e2530" }}
            >
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: "#0d1015", border: "1px solid #1e2530" }}
              >
                <div
                  className="text-[11px] font-mono uppercase tracking-widest"
                  style={{ color: "#56627a" }}
                >
                  Complete
                </div>
                <div
                  className="mt-0.5 text-lg font-semibold tabular-nums"
                  style={{ color: "#00e5a0" }}
                >
                  {studentSummary.complete}
                </div>
              </div>
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: "#0d1015", border: "1px solid #1e2530" }}
              >
                <div
                  className="text-[11px] font-mono uppercase tracking-widest"
                  style={{ color: "#56627a" }}
                >
                  Incomplete
                </div>
                <div
                  className="mt-0.5 text-lg font-semibold tabular-nums"
                  style={{ color: "#ffb03a" }}
                >
                  {studentSummary.incomplete}
                </div>
              </div>
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: "#0d1015", border: "1px solid #1e2530" }}
              >
                <div
                  className="text-[11px] font-mono uppercase tracking-widest"
                  style={{ color: "#56627a" }}
                >
                  Avg duration
                </div>
                <div
                  className="mt-0.5 text-lg font-semibold tabular-nums"
                  style={{ color: "#4d9fff" }}
                >
                  {studentSummary.avg != null ? `${studentSummary.avg}m` : "—"}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="sticky top-0"
                    style={{
                      background: "#111418",
                      borderBottom: "1px solid #1e2530",
                    }}
                  >
                    <th
                      className="text-left px-5 py-2.5 text-xs font-mono uppercase tracking-wider"
                      style={{ color: "#56627a" }}
                    >
                      Date
                    </th>
                    <th
                      className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                      style={{ color: "#56627a" }}
                    >
                      Clock In
                    </th>
                    <th
                      className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                      style={{ color: "#56627a" }}
                    >
                      Clock Out
                    </th>
                    <th
                      className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                      style={{ color: "#56627a" }}
                    >
                      Duration
                    </th>
                    <th
                      className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                      style={{ color: "#56627a" }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentRecords.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom:
                          i < studentRecords.length - 1
                            ? "1px solid #161b22"
                            : "none",
                        background: "#0d1015",
                      }}
                    >
                      <td
                        className="px-5 py-2.5 font-mono text-xs"
                        style={{ color: "#56627a" }}
                      >
                        {r.date}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-xs"
                        style={{ color: "#dde2ec" }}
                      >
                        {r.clockIn}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-xs"
                        style={{ color: r.clockOut ? "#dde2ec" : "#2e3540" }}
                      >
                        {r.clockOut ?? "—"}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-xs"
                        style={{
                          color:
                            r.durationMinutes != null ? "#dde2ec" : "#2e3540",
                        }}
                      >
                        {r.durationMinutes != null
                          ? `${r.durationMinutes}m`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: `${statusColors[r.status]}15`,
                            color: statusColors[r.status] ?? "#56627a",
                            border: `1px solid ${statusColors[r.status]}30`,
                          }}
                        >
                          {statusLabels[r.status] ?? r.status}
                        </span>
                        {r.override && (
                          <span
                            className="text-xs font-mono px-1.5 py-0.5 rounded ml-1.5"
                            style={{
                              background: "#ffb03a15",
                              color: "#ffb03a",
                              border: "1px solid #ffb03a30",
                            }}
                          >
                            OVR
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
