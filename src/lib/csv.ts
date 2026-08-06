export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => (obj[h] = vals[i] ?? ""))
    return obj
  })
}
