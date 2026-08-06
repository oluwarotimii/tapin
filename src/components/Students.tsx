import { useState } from "react"
import { db, type Student, type StudentStatus } from "../store"
import { importResultMessage } from "../templates"
import ImportPanel from "./ImportPanel"

export default function Students() {
  const [students, setStudents] = useState<Student[]>(() => db.getStudents())
  const [statusFilter, setStatusFilter] = useState<"all" | StudentStatus>("all")
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    status: "active" as StudentStatus,
  })
  const [formError, setFormError] = useState("")
  const [importResult, setImportResult] = useState("")

  function refresh() {
    setStudents([...db.getStudents()])
  }

  function handleAddOpen() {
    setForm({ name: "", studentId: "", status: "active" })
    setFormError("")
    setShowAdd(true)
    setEditId(null)
  }

  function handleEditOpen(s: Student) {
    setForm({ name: s.name, studentId: s.studentId, status: s.status })
    setFormError("")
    setEditId(s.id)
    setShowAdd(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.studentId.trim()) {
      setFormError("Name and Student ID are required")
      return
    }
    const dup = db
      .getStudents()
      .find((s) => s.studentId === form.studentId && s.id !== editId)
    if (dup) {
      setFormError("Student ID already exists")
      return
    }
    if (editId) {
      db.updateStudent(editId, {
        name: form.name,
        studentId: form.studentId,
        status: form.status,
      })
    } else {
      db.addStudent(form.name, form.studentId, form.status)
    }
    refresh()
    setShowAdd(false)
  }

  function handleDelete(id: string) {
    db.deleteStudent(id)
    refresh()
  }

  function handleToggleStatus(s: Student) {
    db.updateStudent(s.id, {
      status: s.status === "active" ? "inactive" : "active",
    })
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

  const filtered = students.filter(
    (s) =>
      (statusFilter === "all" || s.status === statusFilter) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId.includes(search)),
  )

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            Students
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            {students.filter((s) => s.status === "active").length} active ·{" "}
            {students.length} total · {students.filter((s) => s.cardId).length}{" "}
            cards
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
          <button
            onClick={handleAddOpen}
            className="text-xs font-mono px-3 py-1.5 rounded transition-all"
            style={{ background: "#00e5a0", color: "#0a0c0f" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#00ffb3")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#00e5a0")}
          >
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div
          className="flex rounded-lg p-1"
          style={{ background: "#111418", border: "1px solid #1e2530" }}
        >
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3 py-1 rounded-md text-xs font-mono transition-all capitalize"
              style={{
                background: statusFilter === f ? "#1e2530" : "transparent",
                color: statusFilter === f ? "#dde2ec" : "#56627a",
              }}
            >
              {f}
              <span className="ml-1.5 opacity-60">
                {f === "all"
                  ? students.length
                  : students.filter((s) => s.status === f).length}
              </span>
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search name or student ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg text-sm font-mono outline-none"
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            color: "#dde2ec",
            caretColor: "#00e5a0",
          }}
        />
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
                Name
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Student ID
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Card
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Schedule
              </th>
              <th
                className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider"
                style={{ color: "#56627a" }}
              >
                Status
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-xs font-mono"
                  style={{ color: "#2e3540" }}
                >
                  no students found
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? "1px solid #1e2530" : "none",
                    background: "#0d1015",
                  }}
                >
                  <td className="px-4 py-3" style={{ color: "#dde2ec" }}>
                    {s.name}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "#56627a" }}
                  >
                    {s.studentId}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.cardId ? (
                      <span style={{ color: "#00e5a0" }}>{s.cardId}</span>
                    ) : (
                      <span style={{ color: "#2e3540" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {db.hasCustomSchedule(s.id) ? (
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          background: "rgba(0,229,160,0.1)",
                          color: "#00e5a0",
                          border: "1px solid rgba(0,229,160,0.2)",
                        }}
                      >
                        custom
                      </span>
                    ) : (
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          background: "rgba(46,53,64,0.3)",
                          color: "#56627a",
                          border: "1px solid #1e2530",
                        }}
                      >
                        default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(s)}
                      className="text-xs font-mono px-2 py-0.5 rounded transition-all"
                      style={{
                        background:
                          s.status === "active"
                            ? "rgba(0,229,160,0.12)"
                            : "rgba(46,53,64,0.5)",
                        color: s.status === "active" ? "#00e5a0" : "#56627a",
                        border: `1px solid ${
                          s.status === "active"
                            ? "rgba(0,229,160,0.2)"
                            : "#1e2530"
                        }`,
                      }}
                    >
                      {s.status}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleEditOpen(s)}
                        className="text-xs font-mono px-2 py-1 rounded transition-all"
                        style={{
                          color: "#56627a",
                          border: "1px solid #1e2530",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#dde2ec")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#56627a")
                        }
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-xs font-mono px-2 py-1 rounded transition-all"
                        style={{
                          color: "#56627a",
                          border: "1px solid #1e2530",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#ff4d6a")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#56627a")
                        }
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10,12,15,0.85)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false)
          }}
        >
          <div
            className="w-96 rounded-xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: "#111418", border: "1px solid #1e2530" }}
          >
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-semibold"
                style={{ color: "#dde2ec" }}
              >
                {editId ? "Edit Student" : "Add Student"}
              </h2>
              <button
                onClick={() => setShowAdd(false)}
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

            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Maria Santos"
                autoFocus
              />
            </Field>
            <Field label="Student ID">
              <input
                type="text"
                value={form.studentId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, studentId: e.target.value }))
                }
                placeholder="2024-001"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as StudentStatus,
                  }))
                }
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </Field>

            {formError && (
              <div className="text-xs font-mono" style={{ color: "#ff4d6a" }}>
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAdd(false)}
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
                {editId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs font-mono uppercase tracking-widest"
        style={{ color: "#56627a" }}
      >
        {label}
      </label>
      {/* Clone the child with injected styles */}
      <div>
        {(() => {
          const el =
            children as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> & React.SelectHTMLAttributes<HTMLSelectElement>>
          return (
            <el.type
              {...el.props}
              className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
              style={{
                background: "#181c22",
                border: "1px solid #1e2530",
                color: "#dde2ec",
                caretColor: "#00e5a0",
              }}
            />
          )
        })()}
      </div>
    </div>
  )
}
