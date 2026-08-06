import { useState, useRef } from "react"
import { db, parseCSV, type CSVImportResult } from "../store"
import {
  studentsTemplateCSV,
  scheduleTemplateCSV,
  combinedTemplateCSV,
  downloadCSV,
} from "../templates"

interface ImportPanelProps {
  onResult: (r: CSVImportResult | null) => void
}

const TEMPLATES = [
  {
    label: "Students",
    file: "students-template.csv",
    content: studentsTemplateCSV,
    note: "name,student_id,status",
  },
  {
    label: "Schedule (default)",
    file: "schedule-template.csv",
    content: scheduleTemplateCSV,
    note: "day,start,end,minimum_minutes",
  },
  {
    label: "Combined — students + schedules",
    file: "combined-template.csv",
    content: combinedTemplateCSV,
    note: "name,student_id,status,day,start,end,minimum_minutes",
  },
]

export default function ImportPanel({ onResult }: ImportPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      onResult(rows.length > 0 ? db.importUnifiedCSV(rows) : null)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="flex items-center gap-2 relative">
      <button
        onClick={() => fileRef.current?.click()}
        className="text-xs font-mono px-3 py-1.5 rounded transition-all"
        style={{ background: "#181c22", color: "#56627a", border: "1px solid #1e2530" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#dde2ec"
          e.currentTarget.style.borderColor = "#2e3540"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#56627a"
          e.currentTarget.style.borderColor = "#1e2530"
        }}
      >
        Import CSV
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-xs font-mono px-3 py-1.5 rounded transition-all"
          style={{ background: "#111418", color: "#56627a", border: "1px solid #1e2530" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#00e5a0"
            e.currentTarget.style.borderColor = "rgba(0,229,160,0.3)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#56627a"
            e.currentTarget.style.borderColor = "#1e2530"
          }}
        >
          Template ▾
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-full mt-1.5 w-80 rounded-xl p-2 z-50 animate-fade-in"
              style={{ background: "#181c22", border: "1px solid #1e2530" }}
            >
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => {
                    downloadCSV(t.file, t.content())
                    setMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg transition-all"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="text-xs font-mono" style={{ color: "#dde2ec" }}>
                    {t.label}
                    <span className="ml-1.5 text-[10px]" style={{ color: "#00e5a0" }}>download</span>
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: "#2e3a4e" }}>
                    {t.note}
                  </div>
                </button>
              ))}
              <div className="mt-1 px-3 py-2 text-[10px] font-mono leading-relaxed" style={{ color: "#2e3a4e" }}>
                One file can contain students AND their schedules. Rows with a student_id set that student's own week; rows without one set the default template.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
