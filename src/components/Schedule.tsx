"use client"

import { useState, useEffect } from "react"
import { db, type ScheduleDay } from "../store"
import { importResultMessage } from "../templates"
import ImportPanel from "./ImportPanel"

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const TODAY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()]

export default function Schedule() {
  const [target, setTarget] = useState("")
  const [schedule, setSchedule] = useState<ScheduleDay[]>(() => db.getSchedule())
  const [editDay, setEditDay] = useState<string | null>(null)
  const [form, setForm] = useState({ start: "08:00", end: "17:00", minimumMinutes: "180" })
  const [formError, setFormError] = useState("")
  const [importResult, setImportResult] = useState("")

  const students = db.getStudents().filter((s) => s.status === "active")
  const targetName = target === "" ? "Default template" : students.find((s) => s.id === target)?.name ?? "Student"

  function refresh() {
    setSchedule([...(target === "" ? db.getSchedule() : db.getStudentSchedule(target))])
  }

  useEffect(() => {
    setEditDay(null)
    setFormError("")
    refresh()
  }, [target])


  function dayEntry(day: string) {
    return schedule.find((d) => d.day === day)
  }

  function handleEditOpen(day: string) {
    const entry = dayEntry(day)
    setForm({
      start: entry?.start ?? "08:00",
      end: entry?.end ?? "17:00",
      minimumMinutes: String(entry?.minimumMinutes ?? 180),
    })
    setFormError("")
    setEditDay(day)
  }

  function handleSave() {
    if (!editDay) return
    const mins = parseInt(form.minimumMinutes)
    if (!form.start || !form.end || form.start >= form.end) {
      setFormError("Start must be earlier than end")
      return
    }
    if (!mins || mins <= 0) {
      setFormError("Minimum minutes must be at least 1")
      return
    }
    if (target === "") db.setScheduleDay(editDay, form.start, form.end, mins)
    else db.setStudentScheduleDay(target, editDay, form.start, form.end, mins)
    refresh()
    setEditDay(null)
  }

  function handleRemove(day: string) {
    if (target === "") db.removeScheduleDay(day)
    else db.removeStudentScheduleDay(target, day)
    refresh()
  }

  function handleCopyDefault() {
    if (!target) return
    db.copyDefaultSchedule(target)
    refresh()
  }

  function handleImportResult(r: Awaited<ReturnType<typeof db.importUnifiedCSV>> | null) {
    refresh()
    if (!r || (!r.students && !r.slots && !r.defaultSlots)) {
      setImportResult("No valid rows found")
    } else {
      setImportResult(`Imported ${importResultMessage(r)}`)
    }
    setTimeout(() => setImportResult(""), 4000)
  }

  const customCount = db.getStudents().filter((s) => db.hasCustomSchedule(s.id)).length

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Schedule
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            per-student weeks · {customCount} student(s) with a custom schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          {importResult && (
            <span
              className="text-xs font-mono px-2 py-1 rounded animate-fade-in"
              style={{ color: "#00e5a0", background: "rgba(0,229,160,0.1)" }}
            >
              {importResult}
            </span>
          )}
          <ImportPanel onResult={handleImportResult} />
        </div>
      </div>

      {/* Target selector */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "#111418", border: "1px solid #1e2530" }}>
        <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#56627a" }}>
          Editing
        </div>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
          style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec" }}
        >
          <option value="">Default template — for all new students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.studentId}
              {db.hasCustomSchedule(s.id) ? " (custom)" : ""}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs font-mono" style={{ color: "#2e3a4e" }}>
          {target === ""
            ? "Students without their own schedule inherit this template."
            : `Editing ${targetName}'s own week. ${db.hasCustomSchedule(target) ? "Overrides the default template." : "Currently inherits the default template."}`}
        </div>
        {target !== "" && (
          <button
            onClick={handleCopyDefault}
            className="mt-3 text-xs font-mono px-3 py-1.5 rounded transition-all"
            style={{ color: "#4d9fff", border: "1px solid rgba(77,159,255,0.3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(77,159,255,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Copy default template into this student's week
          </button>
        )}
      </div>

      {/* Day grid */}
      <div className="flex flex-col gap-2">
        {ALL_DAYS.map((day) => {
          const entry = dayEntry(day)
          const active = !!entry
          return (
            <div
              key={day}
              className="flex items-center gap-4 rounded-xl px-5 py-4"
              style={{
                background: active ? "#111418" : "#0d1015",
                border: `1px solid ${day === TODAY ? "rgba(0,229,160,0.35)" : active ? "#1e2530" : "#181c22"}`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: active ? "#00e5a0" : "#2e3540", boxShadow: active ? "0 0 6px #00e5a0" : "none" }}
              />
              <div className="w-24 text-sm capitalize flex items-center gap-1.5" style={{ color: active ? "#dde2ec" : "#56627a" }}>
                {day}
                {day === TODAY && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase" style={{ background: "rgba(0,229,160,0.12)", color: "#00e5a0", border: "1px solid rgba(0,229,160,0.2)" }}>
                    today
                  </span>
                )}
              </div>

              {active ? (
                <>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-mono" style={{ color: "#00e5a0" }}>
                      {entry.start}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#2e3540" }}>
                      →
                    </span>
                    <span className="text-sm font-mono" style={{ color: "#00e5a0" }}>
                      {entry.end}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded ml-2" style={{ background: "#181c22", color: "#56627a", border: "1px solid #1e2530" }}>
                      min {entry.minimumMinutes}m
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditOpen(day)}
                      className="text-xs font-mono px-2.5 py-1 rounded transition-all"
                      style={{ color: "#56627a", border: "1px solid #1e2530" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#dde2ec")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#56627a")}
                    >
                      edit
                    </button>
                    <button
                      onClick={() => handleRemove(day)}
                      className="text-xs font-mono px-2.5 py-1 rounded transition-all"
                      style={{ color: "#56627a", border: "1px solid #1e2530" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ff4d6a")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#56627a")}
                    >
                      remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 text-xs font-mono" style={{ color: "#2e3540" }}>
                    no schedule
                  </div>
                  <button
                    onClick={() => handleEditOpen(day)}
                    className="text-xs font-mono px-2.5 py-1 rounded transition-all"
                    style={{ color: "#56627a", border: "1px solid #1e2530" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00e5a0")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#56627a")}
                  >
                    + set
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Import hint */}
      <div className="mt-6 rounded-xl p-4" style={{ background: "#111418", border: "1px solid #1e2530" }}>
        <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#2e3a4e" }}>
          CSV import
        </div>
        <p className="text-xs font-mono" style={{ color: "#56627a", lineHeight: 1.8 }}>
          One file can import students and their schedules at once. Each row may add a student, a schedule slot, or
          both — rows with a <span style={{ color: "#00e5a0" }}>student_id</span> set that student's own week, rows
          without one set the default template. Use the Template button for a ready-to-fill format.
        </p>
      </div>

      {/* Edit modal */}
      {editDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10,12,15,0.85)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditDay(null)
          }}
        >
          <div
            className="w-96 rounded-xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold capitalize" style={{ color: "#dde2ec" }}>
                {editDay}
              </h2>
              <button onClick={() => setEditDay(null)} style={{ color: "#56627a" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
                  Start
                </label>
                <input
                  type="time"
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
                  style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
                  End
                </label>
                <input
                  type="time"
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
                  style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
                Minimum Minutes
              </label>
              <input
                type="number"
                value={form.minimumMinutes}
                onChange={(e) => setForm((f) => ({ ...f, minimumMinutes: e.target.value }))}
                min="0"
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
                style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec", caretColor: "#00e5a0" }}
              />
              <p className="text-xs font-mono" style={{ color: "#2e3540" }}>
                students cannot clock out before this many minutes
              </p>
            </div>

            {formError && (
              <div className="text-xs font-mono" style={{ color: "#ff4d6a" }}>
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditDay(null)}
                className="text-xs font-mono px-4 py-2 rounded"
                style={{ color: "#56627a", border: "1px solid #1e2530" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-mono px-4 py-2 rounded"
                style={{ background: "#00e5a0", color: "#0a0c0f" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
