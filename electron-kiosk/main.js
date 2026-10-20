// TapIn kiosk shell. A thin Electron wrapper around the real, hosted
// TapIn web app — no bundled database, no bundled copy of the Next.js
// server. Two jobs only:
//   1. Show the hosted /terminal page full-screen, with no visible
//      Electron/browser chrome, and handle network loss gracefully
//      (instant local splash on launch, a local "reconnecting" screen
//      instead of a browser error page, automatic retry).
//   2. Run the wCopy USB reader bridge (bridge.js) in this same process,
//      so it's always running the moment the kiosk launches — no
//      separate service for an operator to remember to start.
const { app, BrowserWindow, globalShortcut } = require("electron")
const path = require("path")
const { startBridge } = require("./bridge")

const KIOSK_URL = process.env.TAPIN_KIOSK_URL || "http://localhost:8443/terminal"
const RETRY_MS = 3000

let mainWindow = null
let retryTimer = null
let awaitingRetry = false

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0c0f", // matches the real terminal's bg — no white flash
    icon: path.join(__dirname, "build-resources", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.once("ready-to-show", () => mainWindow.show())

  // Show instantly from a local file — zero network dependency for the
  // very first frame, so launch never feels like it's waiting on anything.
  mainWindow.loadFile(path.join(__dirname, "splash.html"))

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (errorCode === -3) return // ERR_ABORTED — we interrupted our own load, not a real failure
    goOffline()
  })
  mainWindow.webContents.on("did-finish-load", () => {
    const url = mainWindow.webContents.getURL()
    if (url.startsWith(KIOSK_URL.split("?")[0].replace(/\/$/, ""))) {
      awaitingRetry = false
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }
  })

  loadKiosk()
}

function loadKiosk() {
  mainWindow.loadURL(KIOSK_URL).catch(() => goOffline())
}

function goOffline() {
  if (awaitingRetry) return
  awaitingRetry = true
  mainWindow.loadFile(path.join(__dirname, "offline.html"))
  scheduleRetry()
}

function scheduleRetry() {
  retryTimer = setTimeout(() => {
    if (!awaitingRetry) return
    loadKiosk()
  }, RETRY_MS)
}

app.whenReady().then(() => {
  createWindow()
  startBridge()

  // Hidden admin escape hatches — not surfaced in the UI, so the kiosk
  // reads as a sealed appliance to normal users.
  globalShortcut.register("Control+Shift+Q", () => app.quit())
  globalShortcut.register("Control+Shift+I", () => mainWindow?.webContents.toggleDevTools())
  globalShortcut.register("Control+Shift+R", () => loadKiosk())
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})
