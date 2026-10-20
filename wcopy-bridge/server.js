// Local bridge for the "NSCCN / wCopy Smart Reader" (VID 0x0416, PID 0xb030).
// Runs on the same machine as the physical reader; the browser-based
// TapIn kiosk (src/lib/wcopyBridge.ts) talks to it over HTTP, mirroring
// the existing fingerprint bridge's architecture (src/lib/fingerprintBridge.ts).
//
// Needs node-hid (native addon), so this can't run inside Next.js's
// server runtime — it's a standalone process the kiosk machine runs
// alongside the browser. See AGENTS.md / docs/fingerprint-integration.md
// for why this shape (local companion bridge) is the established pattern
// for hardware this app can't reach from a server or a browser tab alone.
const http = require("http")
const HID = require("node-hid")
const {
  frameCommand,
  parseResponse,
  resetSequence,
  COMMANDS,
  PN532_COMMANDS,
  parseDetectResponse,
} = require("./protocol")

const PORT = process.env.WCOPY_BRIDGE_PORT || 8788
const VENDOR_ID = 0x0416
const PRODUCT_ID = 0xb030

let openDevice = null

function openReader() {
  if (openDevice) return openDevice
  const info = HID.devices(VENDOR_ID, PRODUCT_ID)[0]
  if (!info) return null
  resetSequence()
  openDevice = new HID.HID(info.path)
  openDevice.on("error", () => {
    openDevice = null
  })
  return openDevice
}

function closeReader() {
  if (openDevice) {
    try {
      openDevice.close()
    } catch {
      // already closed
    }
    openDevice = null
  }
}

// Sends a framed command and waits (via the device's "data" event) for the
// next response, or null on timeout. Only one in-flight command at a time —
// this reader has no request/response correlation beyond the sequence
// counter, so concurrent callers would race.
function sendCommand(payload, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const dev = openReader()
    if (!dev) return resolve(null)
    let done = false
    const onData = (buf) => {
      if (done) return
      done = true
      dev.removeListener("data", onData)
      clearTimeout(timer)
      resolve(parseResponse(buf))
    }
    const timer = setTimeout(() => {
      if (done) return
      done = true
      dev.removeListener("data", onData)
      resolve(null)
    }, timeoutMs)
    dev.on("data", onData)
    try {
      dev.write(frameCommand(payload))
    } catch {
      done = true
      dev.removeListener("data", onData)
      clearTimeout(timer)
      resolve(null)
    }
  })
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return
  }

  if (req.method === "GET" && req.url === "/status") {
    const info = HID.devices(VENDOR_ID, PRODUCT_ID)[0]
    sendJson(res, 200, {
      connected: !!info,
      device: info
        ? { manufacturer: info.manufacturer, product: info.product }
        : null,
    })
    return
  }

  if (req.method === "GET" && req.url === "/info") {
    const resp = await sendCommand(COMMANDS.deviceInfo)
    if (!resp) return sendJson(res, 503, { ok: false, error: "no response from reader" })
    sendJson(res, 200, { ok: true, firmware: resp.ascii.trim() })
    return
  }

  // InListPassiveTarget (PN532) — confirmed byte-for-byte against a real
  // capture of nfcPro_x64.exe's actual traffic. Returns UID/ATQA/SAK.
  if (req.method === "POST" && req.url === "/detect-card") {
    const resp = await sendCommand(PN532_COMMANDS.detectCard)
    if (!resp) return sendJson(res, 503, { ok: false, error: "no response from reader" })
    const detected = parseDetectResponse(resp.content)
    if (!detected || !detected.found) {
      return sendJson(res, 200, { ok: true, found: false })
    }
    sendJson(res, 200, { ok: true, found: true, uid: detected.uid, atqa: detected.atqa, sak: detected.sak })
    return
  }

  // TODO: page-read response shape isn't live-verified yet (command bytes
  // are standard FAST_READ, but parseReadPageResponse needs confirmation
  // against real traffic before this is wired up the same way as /detect-card).

  sendJson(res, 404, { error: "not found" })
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`wcopy-bridge listening on http://127.0.0.1:${PORT}`)
})

process.on("SIGINT", () => {
  closeReader()
  process.exit(0)
})
