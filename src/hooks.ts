import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { subscribeStore, getVersion } from "./store"
import { reader } from "./reader"
import { bridgeStatus } from "./lib/fingerprintBridge"
import { wcopyBridgeStatus, detectCard } from "./lib/wcopyBridge"

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

const WCOPY_POLL_MS = 4000

// Polls the local wcopy-bridge companion service for connectivity only
// (not detection — see useWcopyAutoTap for that). Mirrors
// useFingerprintBridgeConnected's shape.
export function useWcopyBridgeConnected() {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function poll() {
      const ok = await wcopyBridgeStatus()
      if (!cancelled) setConnected(ok)
    }
    poll()
    const t = setInterval(poll, WCOPY_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])
  return connected
}

const WCOPY_DETECT_POLL_MS = 400

// Continuously polls wcopy-bridge's /detect-card and fires a tap the
// moment a card is presented (rising edge only — the card must be lifted
// off and re-presented before it can tap again, same as a normal reader,
// not re-tapping every poll cycle while it sits on the reader).
export function useWcopyAutoTap(enabled: boolean) {
  const wasPresentRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      wasPresentRef.current = false
      return
    }
    let cancelled = false
    async function poll() {
      const result = await detectCard()
      if (cancelled || !result) return
      if (result.found && !wasPresentRef.current) {
        wasPresentRef.current = true
        reader.submitCardTap(result.uid)
      } else if (!result.found) {
        wasPresentRef.current = false
      }
    }
    const t = setInterval(poll, WCOPY_DETECT_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [enabled])
}
