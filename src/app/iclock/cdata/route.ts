import {
  ensureDevice,
  handshakeResponse,
  isSerialAllowed,
  processAttlog,
} from "@/server/adms"

export const dynamic = "force-dynamic"

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

function serialOf(req: Request): string {
  const url = new URL(req.url)
  return (url.searchParams.get("SN") ?? url.searchParams.get("sn") ?? "").trim()
}

// Handshake / option request and server-initiated data queries.
//   GET /iclock/cdata?SN=<serial>&options=all&pushver=...&language=...
export async function GET(req: Request) {
  const serial = serialOf(req)
  if (!serial) return text("ERROR: missing SN", 400)
  if (!isSerialAllowed(serial)) return text("ERROR: device not allowed", 403)

  const url = new URL(req.url)
  const options = url.searchParams.get("options")
  const table = url.searchParams.get("table")

  if (!table || options) {
    const device = await ensureDevice(serial)
    if (!device.enabled) return text("ERROR: device disabled", 403)
    return text(handshakeResponse(serial, device.lastStamp))
  }

  // table=ATTLOG (etc.) here means the server is being asked to hand data
  // down to the device. We don't push attendance back down; acknowledge with
  // an empty result so the device isn't left waiting.
  return text("OK")
}

// Attendance / operation log upload.
//   POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<n>
export async function POST(req: Request) {
  const serial = serialOf(req)
  if (!serial) return text("ERROR: missing SN", 400)
  if (!isSerialAllowed(serial)) return text("ERROR: device not allowed", 403)

  const url = new URL(req.url)
  const table = (url.searchParams.get("table") ?? "").toUpperCase()
  const stampRaw = url.searchParams.get("Stamp")
  const stamp = stampRaw ? Number.parseInt(stampRaw, 10) : undefined
  const body = await req.text()

  if (table === "ATTLOG") {
    const res = await processAttlog(
      serial,
      body,
      Number.isFinite(stamp) ? stamp : undefined,
    )
    return text(`OK: ${res.accepted}`)
  }

  // OPERLOG, ATTPHOTO, etc. — register the device and acknowledge so it
  // clears its outbound queue.
  await ensureDevice(serial)
  return text("OK")
}