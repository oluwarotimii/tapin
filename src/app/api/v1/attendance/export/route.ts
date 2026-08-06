import { authorizeRequest, authFailResponse } from "@/server/guard"
import { exportAttendanceCSV } from "@/server/students"

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, ["attendance_read"])
  if (!auth.ok) return authFailResponse(auth)
  const csv = await exportAttendanceCSV()
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
