import "server-only"
import { prisma } from "@/lib/db"
import { tapByStudentIdAt } from "@/server/domain"

// ── ZKTeco ADMS / push protocol ─────────────────────────────────────────────
// The UA300 keeps its fingerprint templates and does its own 1:N match. When
// it recognises a finger it pushes an ATTLOG line to this app; we map the
// device PIN (which must equal Student.studentId) to a student and apply the
// same tap rules as the kiosk. See docs/adms-integration.md for the protocol
// and how to configure the terminal.

// Optional allowlist. Set ADMS_ALLOWED_SERIALS to a comma-separated list of
// device serial numbers in production — the ADMS endpoints are unauthenticated
// (the terminal cannot easily send a bearer token), so the serial is the only
// thing identifying the device. When unset, any serial is accepted and
// auto-registered, which is convenient for first-time setup/testing.
export function isSerialAllowed(serial: string): boolean {
  const raw = process.env.ADMS_ALLOWED_SERIALS?.trim()
  if (!raw) return true
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(serial)
}

// ── device registry ─────────────────────────────────────────────────────────
export async function ensureDevice(serial: string) {
  const name = process.env.ADMS_DEVICE_NAME?.trim() || "ZKTeco device"
  return prisma.device.upsert({
    where: { serial },
    create: { serial, name },
    update: { lastSeenAt: new Date() },
  })
}

// ── handshake ───────────────────────────────────────────────────────────────
// Response to `GET /iclock/cdata?...&options=all`. Plain text, one directive
// per line. Realtime=1 tells the device to push each punch as it happens
// instead of batching on a timer. Stamp is the last stamp we processed so the
// device resumes rather than replaying its whole log.
export function handshakeResponse(serial: string, lastStamp: number): string {
  return [
    `GET OPTION FROM: ${serial}`,
    `Stamp=${lastStamp}`,
    `OpStamp=${lastStamp}`,
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog AttPhoto UserInfo FP",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n")
}

// ── ATTLOG parsing ──────────────────────────────────────────────────────────
export interface PunchLine {
  pin: string
  punchedAt: Date
  status: string
  verifyMode: string
  workCode: string
}

// Device date/time is "YYYY-MM-DD HH:mm:ss" in the terminal's local timezone.
// Parsed as a wall-clock local time — the server and terminal should share a
// timezone (see docs/adms-integration.md).
export function parsePunchTime(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  )
  return Number.isNaN(dt.getTime()) ? null : dt
}

// One ATTLOG record per line, tab-separated:
//   PIN \t DateTime \t Status \t Verify \t WorkCode \t ...
export function parseAttlog(body: string): PunchLine[] {
  const out: PunchLine[] = []
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue
    const f = line.split("\t")
    if (f.length < 2) continue
    const pin = f[0].trim()
    const punchedAt = parsePunchTime(f[1])
    if (!pin || !punchedAt) continue
    out.push({
      pin,
      punchedAt,
      status: (f[2] ?? "").trim(),
      verifyMode: (f[3] ?? "").trim(),
      workCode: (f[4] ?? "").trim(),
    })
  }
  return out
}

// ── processing ──────────────────────────────────────────────────────────────
export interface AttlogResult {
  total: number
  accepted: number
  duplicates: number
}

export async function processAttlog(
  serial: string,
  body: string,
  stamp?: number,
): Promise<AttlogResult> {
  const device = await ensureDevice(serial)
  const punches = parseAttlog(body)

  let accepted = 0
  let duplicates = 0

  // A disabled device is acknowledged (so it stops retrying) but its punches
  // are not applied.
  if (!device.enabled) {
    return { total: punches.length, accepted: 0, duplicates: 0 }
  }

  // Sequential on purpose: two punches for the same student in one batch must
  // see each other's session changes, and the toggle logic is not safe to run
  // concurrently.
  for (const p of punches) {
    const where = {
      deviceId_pin_punchedAt: {
        deviceId: device.id,
        pin: p.pin,
        punchedAt: p.punchedAt,
      },
    }
    const already = await prisma.devicePunch.findUnique({ where })
    if (already) {
      duplicates++
      continue
    }

    let punchId: string
    try {
      const created = await prisma.devicePunch.create({
        data: {
          deviceId: device.id,
          pin: p.pin,
          punchedAt: p.punchedAt,
          status: p.status,
          verifyMode: p.verifyMode,
          workCode: p.workCode,
        },
      })
      punchId = created.id
    } catch {
      // Unique violation from a concurrent batch — treat as duplicate.
      duplicates++
      continue
    }

    try {
      const result = await tapByStudentIdAt(p.pin, p.punchedAt, "adms")
      await prisma.devicePunch.update({
        where: { id: punchId },
        data: { result: result.kind },
      })
      accepted++
    } catch {
      // Roll the dedupe row back so a transient failure is retried on the
      // device's next push instead of being silently swallowed.
      await prisma.devicePunch.delete({ where: { id: punchId } }).catch(() => {})
    }
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      ...(stamp && stamp > device.lastStamp ? { lastStamp: stamp } : {}),
    },
  })

  return { total: punches.length, accepted, duplicates }
}

// ── admin reads ─────────────────────────────────────────────────────────────
export async function getDevices() {
  return prisma.device.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { punches: true } } },
  })
}

export async function getRecentPunches(limit = 50) {
  return prisma.devicePunch.findMany({
    orderBy: { punchedAt: "desc" },
    take: limit,
    include: {
      device: { select: { serial: true, name: true } },
    },
  })
}