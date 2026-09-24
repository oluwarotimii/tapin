import { useEffect, useState, useSyncExternalStore } from "react"
import { subscribeStore, getVersion } from "./store"
import { reader } from "./reader"
import { bridgeStatus } from "./lib/fingerprintBridge"

export function useStore() {
  return useSyncExternalStore(subscribeStore, getVersion)
}

export function useReaderStatus() {
  return useSyncExternalStore(reader.subscribeStatus, reader.getStatus)
}

const BRIDGE_POLL_MS = 4000

// Polls the local fingerprint companion bridge (docs/fingerprint-integration.md).
// Reports false until a real bridge is deployed and reachable — no fake state.
export function useFingerprintBridgeConnected() {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function poll() {
      const ok = await bridgeStatus()
      if (!cancelled) setConnected(ok)
    }
    poll()
    const t = setInterval(poll, BRIDGE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])
  return connected
}
