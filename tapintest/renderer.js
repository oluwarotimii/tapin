const devicesEl = document.getElementById("devices")
const statusEl = document.getElementById("status")
const logEl = document.getElementById("log")
const connectBtn = document.getElementById("connect")
const disconnectBtn = document.getElementById("disconnect")
const refreshBtn = document.getElementById("refresh")
const copyBtn = document.getElementById("copy")
const clearBtn = document.getElementById("clear")
const cardStatusEl = document.getElementById("cardStatus")
const autoDetectEl = document.getElementById("autoDetect")

let devices = []

function setStatus(text) {
  statusEl.textContent = text
}

function appendLog(line) {
  const div = document.createElement("div")
  div.className = "entry"
  div.textContent = line
  logEl.appendChild(div)
  logEl.scrollTop = logEl.scrollHeight
}

async function refreshDevices() {
  const result = await window.tapintest.listDevices()
  if (result && result.error) {
    setStatus("Error listing devices: " + result.error)
    return
  }
  devices = result
  devicesEl.innerHTML = ""
  devices.forEach((d, i) => {
    const opt = document.createElement("option")
    opt.value = i
    opt.textContent = `${d.manufacturer} / ${d.product}  (VID:${d.vendorId.toString(16)} PID:${d.productId.toString(16)}, usagePage:${d.usagePage}, usage:${d.usage}, iface:${d.interface})`
    devicesEl.appendChild(opt)
  })
  setStatus(`Found ${devices.length} HID device(s). Pick one and hit Connect.`)
}

connectBtn.addEventListener("click", async () => {
  const idx = Number(devicesEl.value)
  const d = devices[idx]
  if (!d) {
    setStatus("No device selected.")
    return
  }
  const result = await window.tapintest.openDevice(d.path)
  if (result.ok) {
    setStatus(`Connected to ${d.manufacturer} / ${d.product}. Tap a card now.`)
    connectBtn.disabled = true
    disconnectBtn.disabled = false
    appendLog(`-- connected: ${d.manufacturer} / ${d.product} (VID:${d.vendorId.toString(16)} PID:${d.productId.toString(16)}) --`)
  } else {
    setStatus("Failed to open device: " + result.error)
  }
})

disconnectBtn.addEventListener("click", async () => {
  await window.tapintest.closeDevice()
  autoDetectEl.checked = false
  cardStatusEl.textContent = "waiting for a tap..."
  cardStatusEl.style.color = "#56627a"
  setStatus("Disconnected.")
  connectBtn.disabled = false
  disconnectBtn.disabled = true
  appendLog("-- disconnected --")
})

refreshBtn.addEventListener("click", refreshDevices)

clearBtn.addEventListener("click", () => {
  logEl.innerHTML = ""
})

copyBtn.addEventListener("click", async () => {
  const text = Array.from(logEl.querySelectorAll(".entry"))
    .map((el) => el.textContent)
    .join("\n")
  await navigator.clipboard.writeText(text)
  setStatus("Log copied to clipboard.")
})

window.tapintest.onData((payload) => {
  if (payload.pn532 && payload.pn532.kind === "detect") {
    if (payload.pn532.found) {
      cardStatusEl.textContent = `CARD: UID=${payload.pn532.uid} ATQA=${payload.pn532.atqa} SAK=${payload.pn532.sak}`
      cardStatusEl.style.color = "#00e5a0"
      appendLog(`[${payload.time}] *** CARD DETECTED: UID=${payload.pn532.uid} ATQA=${payload.pn532.atqa} SAK=${payload.pn532.sak} ***`)
    } else if (autoDetectEl.checked) {
      cardStatusEl.textContent = "waiting for a tap..."
      cardStatusEl.style.color = "#56627a"
    }
  } else if (payload.pn532 && payload.pn532.kind === "readPage") {
    if (payload.pn532.ok) {
      appendLog(`[${payload.time}] *** PAGE DATA: ${payload.pn532.dataHex} ***`)
    } else {
      appendLog(`[${payload.time}] !! read page error, status=0x${payload.pn532.status.toString(16)}`)
    }
  }

  if (payload.decoded) {
    const d = payload.decoded
    appendLog(
      `[${payload.time}] hex: ${payload.hex.slice(0, 40)}...  |  decoded: status=0x${(d.status ?? 0).toString(16).padStart(2, "0")} totalLen=${d.totalLen} seq=${d.seqEcho} content=${d.contentHex} ascii="${d.ascii}"`,
    )
  } else {
    appendLog(`[${payload.time}] len=${payload.length}  hex: ${payload.hex}`)
  }
})

autoDetectEl.addEventListener("change", async () => {
  if (autoDetectEl.checked) {
    await window.tapintest.startAutoPoll()
    cardStatusEl.textContent = "waiting for a tap..."
    cardStatusEl.style.color = "#56627a"
    appendLog("-- auto-detect started --")
  } else {
    await window.tapintest.stopAutoPoll()
    appendLog("-- auto-detect stopped --")
  }
})

window.tapintest.onError((msg) => {
  appendLog(`!! error: ${msg}`)
  setStatus("Device error: " + msg)
})

function parseHexBytes(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean)
  const bytes = parts.map((p) => parseInt(p, 16))
  if (bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) return null
  return bytes
}

function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")
}

const reportIdEl = document.getElementById("reportId")
const reportLenEl = document.getElementById("reportLen")
const hexBytesEl = document.getElementById("hexBytes")
const autoPollEl = document.getElementById("autoPoll")
let pollTimer = null

async function getFeatureOnce({ quiet } = {}) {
  const reportId = Number(reportIdEl.value) || 0
  const length = Number(reportLenEl.value) || 32
  const result = await window.tapintest.getFeatureReport(reportId, length)
  if (result.ok) {
    appendLog(`[feature id=${reportId}] ${bytesToHex(result.data)}`)
  } else if (!quiet) {
    appendLog(`!! feature report (id=${reportId}) failed: ${result.error}`)
  }
}

document.getElementById("getFeature").addEventListener("click", () => getFeatureOnce())

document.getElementById("sendFeature").addEventListener("click", async () => {
  const bytes = parseHexBytes(hexBytesEl.value)
  if (!bytes) {
    setStatus("Invalid hex bytes.")
    return
  }
  const result = await window.tapintest.sendFeatureReport(bytes)
  appendLog(
    result.ok
      ? `-- sent feature report: ${bytesToHex(bytes)} --`
      : `!! send feature report failed: ${result.error}`,
  )
})

document.getElementById("writeOutput").addEventListener("click", async () => {
  const bytes = parseHexBytes(hexBytesEl.value)
  if (!bytes) {
    setStatus("Invalid hex bytes.")
    return
  }
  const result = await window.tapintest.writeOutput(bytes)
  appendLog(
    result.ok
      ? `-- wrote output report (${result.written} bytes): ${bytesToHex(bytes)} --`
      : `!! write output report failed: ${result.error}`,
  )
})

autoPollEl.addEventListener("change", () => {
  if (autoPollEl.checked) {
    pollTimer = setInterval(() => getFeatureOnce({ quiet: true }), 400)
  } else if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

const cmdPayloadEl = document.getElementById("cmdPayload")
const cmdAutoPollEl = document.getElementById("cmdAutoPoll")
let cmdPollTimer = null

async function sendCommandOnce({ quiet } = {}) {
  const bytes = parseHexBytes(cmdPayloadEl.value)
  if (!bytes) {
    if (!quiet) setStatus("Invalid payload hex.")
    return
  }
  const result = await window.tapintest.sendCommand(cmdPayloadEl.value)
  if (!result.ok && !quiet) {
    appendLog(`!! send-command failed: ${result.error}`)
  }
}

document.getElementById("sendCmd").addEventListener("click", () => sendCommandOnce())

document.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    cmdPayloadEl.value = btn.dataset.payload
    sendCommandOnce()
  })
})

cmdAutoPollEl.addEventListener("change", () => {
  if (cmdAutoPollEl.checked) {
    cmdPollTimer = setInterval(() => sendCommandOnce({ quiet: true }), 300)
  } else if (cmdPollTimer) {
    clearInterval(cmdPollTimer)
    cmdPollTimer = null
  }
})

document.getElementById("detectThenRead").addEventListener("click", async () => {
  appendLog("-- detect-then-read: sending detect --")
  await window.tapintest.sendCommand("ff 00 00 00 04 d4 4a 01 00")
  await new Promise((r) => setTimeout(r, 150))
  appendLog("-- detect-then-read: sending read page 0 (no delay) --")
  await window.tapintest.sendCommand("ff 00 00 00 06 d4 40 01 3a 00 00")
})

refreshDevices()
