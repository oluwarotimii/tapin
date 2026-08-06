export function studentsTemplateCSV() {
  return [
    "name,student_id,status",
    "Maria Santos,2024-001,active",
    "Juan Cruz,2024-002,active",
  ].join("\n")
}

export function scheduleTemplateCSV() {
  return [
    "day,start,end,minimum_minutes",
    "monday,08:00,12:00,180",
    "tuesday,13:00,17:00,120",
  ].join("\n")
}

export function combinedTemplateCSV() {
  return [
    "name,student_id,status,day,start,end,minimum_minutes",
    "Maria Santos,2024-001,active,monday,08:00,12:00,180",
    "Maria Santos,2024-001,active,tuesday,08:00,12:00,180",
    "Juan Cruz,2024-002,active,tuesday,13:00,17:00,120",
    "Juan Cruz,2024-002,active,thursday,13:00,17:00,120",
  ].join("\n")
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function importResultMessage(r: { students: number; slots: number; defaultSlots: number }): string {
  const parts: string[] = []
  if (r.students) parts.push(`${r.students} student(s)`)
  if (r.slots) parts.push(`${r.slots} student schedule slot(s)`)
  if (r.defaultSlots) parts.push(`${r.defaultSlots} default slot(s)`)
  return parts.length ? parts.join(" · ") : "no valid rows"
}
