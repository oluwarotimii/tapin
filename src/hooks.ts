import { useSyncExternalStore } from "react"
import { subscribeStore, getVersion } from "./store"
import { reader } from "./reader"

export function useStore() {
  return useSyncExternalStore(subscribeStore, getVersion)
}

export function useReaderStatus() {
  return useSyncExternalStore(reader.subscribeStatus, reader.getStatus)
}
