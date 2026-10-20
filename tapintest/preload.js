const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("tapintest", {
  listDevices: () => ipcRenderer.invoke("list-devices"),
  openDevice: (devicePath) => ipcRenderer.invoke("open-device", devicePath),
  closeDevice: () => ipcRenderer.invoke("close-device"),
  onData: (cb) => ipcRenderer.on("hid-data", (_e, payload) => cb(payload)),
  onError: (cb) => ipcRenderer.on("hid-error", (_e, msg) => cb(msg)),
  getFeatureReport: (reportId, length) =>
    ipcRenderer.invoke("get-feature-report", { reportId, length }),
  sendFeatureReport: (bytes) => ipcRenderer.invoke("send-feature-report", bytes),
  writeOutput: (bytes) => ipcRenderer.invoke("write-output", bytes),
  sendCommand: (payloadHex) => ipcRenderer.invoke("send-command", payloadHex),
  startAutoPoll: () => ipcRenderer.invoke("start-auto-poll"),
  stopAutoPoll: () => ipcRenderer.invoke("stop-auto-poll"),
})
