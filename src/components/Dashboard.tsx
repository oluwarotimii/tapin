"use client"

import { useState, useEffect } from "react"
import { useStore } from "../hooks"
import { db } from "../store"

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  complete: { label: "complete", color: "#00e5a0" },
  incomplete: { label: "incomplete", color: "#ffb03a" },
  in_progress: { label: "in session", color: "#4d9fff" },
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function durationLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return `${h}h ${pad(m)}m`
}

export default function Dashboard() {
  useStore()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  const today = DAYS[now.getDay()]
  const todayStr = dateStr(now)

  const students = db.getStudents()
  const active = db.getActiveSessions()
  const todayRecords = db
    .getAttendance()
    .filter((r) => r.date === todayStr)
    .sort((a, b) => (a.clockIn < b.clockIn ? 1 : -1))

  const activeStudents = students.filter((s) => s.status === "active")
  const cardsIssued = students.filter((s) => s.cardId).length
  const completedToday = todayRecords.filter(
    (r) => r.status === "complete",
  ).length
  const inProgressToday = todayRecords.filter(
    (r) => r.status === "in_progress",
  ).length

  const stats = [
    { label: "In session now", value: String(active.length), color: "#4d9fff" },
    {
      label: "Active students",
      value: `${activeStudents.length}/${students.length}`,
      color: "#00e5a0",
    },
    { label: "Cards issued", value: String(cardsIssued), color: "#00e5a0" },
    {
      label: "Completed today",
      value: `${completedToday}/${todayRecords.length}`,
      color: "#ffb03a",
    },
  ]

  const week = DAYS.map((day, i) => {
    const count = students.filter(
      (st) =>
        st.status === "active" &&
        db.getEffectiveSchedule(st.id).some((d) => d.day === day),
    ).length
    return { day: day.slice(0, 2), count, isToday: i === now.getDay() }
  })
  const todayCoverage = week.find((w) => w.isToday)?.count ?? 0

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Overview
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            live summary · {today} · {todayRecords.length} session(s) today
          </p>
        </div>
        <div
          className="flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
          style={{
            background: "rgba(0,229,160,0.08)",
            color: "#00e5a0",
            border: "1px solid rgba(0,229,160,0.2)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#00e5a0", boxShadow: "0 0 4px #00e5a0" }}
          />
          LIVE
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-4 py-3.5"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div
              className="text-[11px] font-mono uppercase tracking-widest"
              style={{ color: "#56627a" }}
            >
              {s.label}
            </div>
            <div
              className="mt-1.5 text-2xl font-semibold tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's activity */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ border: "1px solid #1e2530" }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: "#111418", borderBottom: "1px solid #1e2530" }}
          >
            <span
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: "#56627a" }}
            >
              Today's activity
            </span>
            <span className="text-xs font-mono" style={{ color: "#2e3a4e" }}>
              {completedToday} done · {inProgressToday} in session
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {todayRecords.length === 0 ? (
                <tr>
                  <td
                    className="text-center py-10 text-xs font-mono"
                    style={{ color: "#2e3540" }}
                  >
                    no taps yet today
                  </td>
                </tr>
              ) : (
                todayRecords.map((r, i) => {
                  const meta = STATUS_META[r.status] ?? {
                    label: r.status,
                    color: "#56627a",
                  }
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom:
                          i < todayRecords.length - 1
                            ? "1px solid #1e2530"
                            : "none",
                        background: "#0d1015",
                      }}
                    >
                      <td className="px-4 py-3">
                        <div style={{ color: "#dde2ec" }}>{r.studentName}</div>
                        <div
                          className="text-xs font-mono"
                          style={{ color: "#2e3a4e" }}
                        >
                          {r.studentId}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs"
                        style={{ color: "#dde2ec" }}
                      >
                        {r.clockIn} → {r.clockOut ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs"
                        style={{
                          color:
                            r.durationMinutes != null ? "#dde2ec" : "#2e3540",
                        }}
                      >
                        {r.durationMinutes != null
                          ? durationLabel(r.durationMinutes)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{
                            background: `${meta.color}15`,
                            color: meta.color,
                            border: `1px solid ${meta.color}30`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* In session now */}
          <div className="rounded-xl" style={{ border: "1px solid #1e2530" }}>
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{
                background: "#111418",
                borderBottom: "1px solid #1e2530",
              }}
            >
              <span
                className="text-xs font-mono uppercase tracking-widest"
                style={{ color: "#56627a" }}
              >
                In session
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: active.length ? "#4d9fff" : "#2e3540",
                  boxShadow: active.length ? "0 0 5px #4d9fff" : "none",
                }}
              />
              <span
                className="text-xs font-mono ml-auto"
                style={{ color: "#2e3a4e" }}
              >
                {active.length}
              </span>
            </div>
            <div
              className="px-4 py-3 flex flex-col gap-2"
              style={{ background: "#0d1015" }}
            >
              {active.length === 0 ? (
                <div
                  className="text-xs font-mono py-1"
                  style={{ color: "#2e3540" }}
                >
                  none clocked in
                </div>
              ) : (
                active.map((s) => {
                  const student = students.find((st) => st.id === s.studentId)
                  const elapsed = Math.max(
                    0,
                    Math.floor(
                      (now.getTime() - new Date(s.clockedInAt).getTime()) /
                        60000,
                    ),
                  )
                  const since = `${pad(new Date(s.clockedInAt).getHours())}:${pad(new Date(s.clockedInAt).getMinutes())}`
                  return (
                    <div key={s.studentId} className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: "#4d9fff" }}
                      />
                      <span
                        className="text-xs truncate"
                        style={{ color: "#dde2ec" }}
                      >
                        {student?.name ?? s.cardId}
                      </span>
                      <span
                        className="text-xs font-mono ml-auto"
                        style={{ color: "#56627a" }}
                      >
                        {since} · {durationLabel(elapsed)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Week schedule */}
          <div className="rounded-xl" style={{ border: "1px solid #1e2530" }}>
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{
                background: "#111418",
                borderBottom: "1px solid #1e2530",
              }}
            >
              <span
                className="text-xs font-mono uppercase tracking-widest"
                style={{ color: "#56627a" }}
              >
                Student coverage
              </span>
              <span className="text-xs font-mono" style={{ color: "#2e3a4e" }}>
                {todayCoverage} today
              </span>
            </div>
            <div
              className="px-4 py-3 flex flex-col gap-1.5"
              style={{ background: "#0d1015" }}
            >
              <div className="flex gap-1.5 mb-1">
                {week.map((d) => {
                  const max = Math.max(1, activeStudents.length)
                  const intensity = d.count > 0 ? 0.06 + 0.14 * Math.min(1, d.count / max) : 0
                  return (
                    <div
                      key={d.day}
                      className="flex-1 rounded-md py-1.5 text-center text-xs font-mono capitalize"
                      style={{
                        background: d.count > 0 ? `rgba(0,229,160,${intensity})` : "rgba(46,53,64,0.2)",
                        color: d.count > 0 ? "#00e5a0" : "#2e3a4e",
                        border: `1px solid ${
                          d.isToday
                            ? "rgba(0,229,160,0.45)"
                            : d.count > 0
                              ? "rgba(0,229,160,0.15)"
                              : "#161b22"
                        }`,
                      }}
                    >
                      {d.day}
                      <span className="ml-0.5" style={{ opacity: 0.7 }}>
                        {d.count}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-xs font-mono" style={{ color: "#56627a" }}>
                {todayCoverage > 0
                  ? `${todayCoverage} of ${activeStudents.length} active student(s) scheduled today`
                  : "no students scheduled today"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
