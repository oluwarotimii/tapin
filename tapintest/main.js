// TapInTest — minimal diagnostic tool. Lists every USB HID device and lets
// you open one and watch raw input report bytes arrive, so an undocumented
// reader's protocol can be inspected directly instead of guessing.
const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const HID = require("node-hid")
const {
  frameCommand,
  parseResponse,
  parseHexBytes,
  resetSequence,
  PN532_COMMANDS,
  parseDetectResponse,
  parseReadPageResponse,
} = require("./protocol")

let openDevice = null
let mainWindow = null

function listDevices() {
  try {
    return HID.devices().map((d) => ({
      path: d.path,
      vendorId: d.vendorId,
      productId: d.productId,
      product: d.product || "(no product string)",
      manufacturer: d.manufacturer || "(no manufacturer string)",
      usagePage: d.usagePage,
      usage: d.usage,
      interface: d.interface,
    }))
  } catch (err) {
    return { error: String(err) }
  }
}

function closeOpenDevice() {
  if (autoPollTimer) {
    clearInterval(autoPollTimer)
    autoPollTimer = null
  }
  if (openDevice) {
    try {
      openDevice.close()
    } catch {
      // already closed
    }
    openDevice = null
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  mainWindow.loadFile("index.html")
}

ipcMain.handle("list-devices", () => listDevices())

ipcMain.handle("open-device", (_event, devicePath) => {
  closeOpenDevice()
  try {
    resetSequence()
    openDevice = new HID.HID(devicePath)
    openDevice.on("data", (buf) => {
      let decoded = null
      let pn532 = null
      try {
        decoded = parseResponse(buf)
        if (decoded.content && decoded.content[0] === 0xd5) {
          if (decoded.content[1] === 0x4b) {
            pn532 = { kind: "detect", ...parseDetectResponse(decoded.content) }
          } else if (decoded.content[1] === 0x41) {
            pn532 = { kind: "readPage", ...parseReadPageResponse(decoded.content) }
            if (pn532.data) pn532.dataHex = Buffer.from(pn532.data).toString("hex")
          }
        }
      } catch {
        // leave decoded/pn532 null if the buffer doesn't look like our frame
      }
      mainWindow?.webContents.send("hid-data", {
        hex: buf.toString("hex"),
        bytes: Array.from(buf),
        length: buf.length,
        time: new Date().toISOString(),
        decoded,
        pn532,
      })
      // Auto-poll chaining: the moment a detect response reports a card
      // found, immediately follow up with a page-0 read (no button press
      // needed) so a tap alone shows full card details, mirroring how the
      // real app behaves.
      if (pn532 && pn532.kind === "detect" && pn532.found && openDevice) {
        try {
          openDevice.write(frameCommand(PN532_COMMANDS.readPage(0)))
        } catch {
          // ignore - device may have just been closed
        }
      }
    })
    openDevice.on("error", (err) => {
      mainWindow?.webContents.send("hid-error", String(err))
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle("close-device", () => {
  closeOpenDevice()
  return { ok: true }
})

ipcMain.handle("get-feature-report", (_event, { reportId, length }) => {
  if (!openDevice) return { ok: false, error: "no device open" }
  try {
    const data = openDevice.getFeatureReport(reportId, length)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle("send-feature-report", (_event, bytes) => {
  if (!openDevice) return { ok: false, error: "no device open" }
  try {
    openDevice.sendFeatureReport(bytes)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle("write-output", (_event, bytes) => {
  if (!openDevice) return { ok: false, error: "no device open" }
  try {
    const written = openDevice.write(bytes)
    return { ok: true, written }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Protocol console: wraps a raw payload (hex string, e.g. "ff 00 6b 30")
// in the reverse-engineered frame format and writes it. The response
// arrives asynchronously via the existing "hid-data" event (now decoded).
ipcMain.handle("send-command", (_event, payloadHex) => {
  if (!openDevice) return { ok: false, error: "no device open" }
  const bytes = parseHexBytes(payloadHex)
  if (!bytes) return { ok: false, error: "invalid hex payload" }
  try {
    const frame = frameCommand(bytes)
    const written = openDevice.write(frame)
    return { ok: true, written, frameHex: frame.toString("hex") }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Auto-poll: continuously sends the detect command in the background so
// the UI behaves like the real app — tap a card, no button press needed.
// A successful detect auto-chains into a page-0 read (see the "data"
// handler above).
let autoPollTimer = null

ipcMain.handle("start-auto-poll", () => {
  if (autoPollTimer) return { ok: true }
  autoPollTimer = setInterval(() => {
    if (!openDevice) return
    try {
      openDevice.write(frameCommand(PN532_COMMANDS.detectCard))
    } catch {
      // ignore transient write errors during polling
    }
  }, 400)
  return { ok: true }
})

ipcMain.handle("stop-auto-poll", () => {
  if (autoPollTimer) {
    clearInterval(autoPollTimer)
    autoPollTimer = null
  }
  return { ok: true }
})

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  closeOpenDevice()
  if (process.platform !== "darwin") app.quit()
})
