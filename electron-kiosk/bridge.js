// The wCopy USB reader bridge (see wcopy-bridge/ for the standalone,
// browser-only version and its full protocol derivation notes), inlined
// here so the kiosk app starts it automatically on launch — no separate
// process for an operator to remember to run.
const http = require("http")
const HID = require("node-hid")
const { frameCommand, parseResponse, resetSequence, PN532_COMMANDS, parseDetectResponse } = require("./protocol")

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

function startBridge() {
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {})
      return
    }

    if (req.method === "GET" && req.url === "/status") {
      const info = HID.devices(VENDOR_ID, PRODUCT_ID)[0]
      sendJson(res, 200, {
        connected: !!info,
        device: info ? { manufacturer: info.manufacturer, product: info.product } : null,
      })
      return
    }

    if (req.method === "POST" && req.url === "/detect-card") {
      const resp = await sendCommand(PN532_COMMANDS.detectCard)
      if (!resp) return sendJson(res, 503, { ok: false, error: "no response from reader" })
      const detected = parseDetectResponse(resp.content)
      if (!detected || !detected.found) {
        return sendJson(res, 200, { ok: true, found: false })
      }
      sendJson(res, 200, {
        ok: true,
        found: true,
        uid: detected.uid,
        atqa: detected.atqa,
        sak: detected.sak,
      })
      return
    }

    sendJson(res, 404, { error: "not found" })
  })

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[wcopy-bridge] listening on http://127.0.0.1:${PORT}`)
  })

  return { server, close: closeReader }
}

module.exports = { startBridge }
