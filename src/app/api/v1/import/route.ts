import { authorizeRequest, authFailResponse } from "@/server/guard"
import { importUnifiedCSV } from "@/server/students"
import { parseCSV } from "@/lib/csv"

export async function POST(req: Request) {
  const auth = await authorizeRequest(req, ["students_write"])
  if (!auth.ok) return authFailResponse(auth)
  const body = await req.text()
  if (!body.trim())
    return Response.json({ error: "empty body" }, { status: 400 })
  try {
    const rows = parseCSV(body)
    const result = await importUnifiedCSV(rows)
    return Response.json({ result })
  } catch {
    return Response.json({ error: "failed to parse CSV" }, { status: 400 })
  }
}
