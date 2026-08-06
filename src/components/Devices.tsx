"use client"

import { useState, useEffect } from "react"
import { reader, type TapEvent } from "../reader"
import { useReaderStatus } from "../hooks"
import { tapTag, hexA } from "../tapFormat"

const STATUS_META: Record<string, { label: string; color: string }> = {
  disconnected: { label: "offline", color: "#ff4d6a" },
  connecting: { label: "connecting", color: "#ffb03a" },
  connected: { label: "online", color: "#00e5a0" },
  error: { label: "error", color: "#ff4d6a" },
}

export default function Devices() {
  const status = useReaderStatus()
  const [feed, setFeed] = useState<TapEvent[]>([])
  const [testCard, setTestCard] = useState("CARD-A1B2")

  useEffect(() => {
    return reader.subscribeTaps((ev) => {
      setFeed((prev) => [ev, ...prev].slice(0, 30))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch("/api/v1/taps/recent")
        if (!res.ok) return
        const j = await res.json()
        if (!cancelled && Array.isArray(j.taps) && j.taps.length) {
          setFeed((prev) => {
            const seen = new Set<string>()
            const merged = [...j.taps, ...prev]
            return merged
              .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
              .slice(0, 30)
          })
        }
      } catch {
        /* ignore */
      }
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const meta = STATUS_META[status] ?? STATUS_META.disconnected
  const lastTap = feed[0]

  function handleTestTap() {
    reader.simulateTap(testCard.trim().toUpperCase())
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
          Devices
        </h1>
        <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
          reader & companion service
        </p>
      </div>

      {/* Reader panel */}
      <div
        className="rounded-xl p-5 mb-4"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: hexA(meta.color, 0.1),
                border: `1px solid ${hexA(meta.color, 0.25)}`,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M2.5 7a7 7 0 0 1 13 0"
                  stroke={meta.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M5 9.5a4.5 4.5 0 0 1 8 0"
                  stroke={meta.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="9" cy="12" r="1.2" fill={meta.color} />
              </svg>
            </div>
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "#dde2ec" }}
              >
                NFC Reader
              </div>
              <div className="text-xs font-mono" style={{ color: "#56627a" }}>
                ACR122U · PC/SC · nfc-pcsc
              </div>
            </div>
          </div>
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-full capitalize"
            style={{
              background: hexA(meta.color, 0.1),
              color: meta.color,
              border: `1px solid ${hexA(meta.color, 0.25)}`,
            }}
          >
            {meta.label}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {status === "connected" ? (
            <button
              onClick={() => reader.disconnect()}
              className="text-xs font-mono px-3 py-1.5 rounded transition-all"
              style={{
                color: "#ff4d6a",
                border: "1px solid rgba(255,77,106,0.3)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,77,106,0.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => reader.connect()}
              disabled={status === "connecting"}
              className="text-xs font-mono px-3 py-1.5 rounded transition-all"
              style={{ background: "#00e5a0", color: "#0a0c0f" }}
              onMouseEnter={(e) => {
                if (status !== "connecting")
                  e.currentTarget.style.background = "#00ffb3"
              }}
              onMouseLeave={(e) => {
                if (status !== "connecting")
                  e.currentTarget.style.background = "#00e5a0"
              }}
            >
              {status === "connecting" ? "Connecting…" : "Connect"}
            </button>
          )}
          <span className="text-xs font-mono" style={{ color: "#2e3540" }}>
            simulated — a real reader is relayed via the companion service
          </span>
        </div>
      </div>

      {/* Test tap */}
      <div
        className="rounded-xl p-5 mb-4"
        style={{ background: "#111418", border: "1px solid #1e2530" }}
      >
        <div
          className="text-xs font-mono uppercase tracking-widest mb-3"
          style={{ color: "#56627a" }}
        >
          Test tap
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={testCard}
            onChange={(e) => setTestCard(e.target.value)}
            disabled={status !== "connected"}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-mono outline-none"
            style={{
              background: "#181c22",
              border: "1px solid #1e2530",
              color: "#dde2ec",
              caretColor: "#00e5a0",
            }}
          />
          <button
            onClick={handleTestTap}
            disabled={status !== "connected"}
            className="text-xs font-mono px-4 py-2.5 rounded-lg transition-all"
            style={{
              background:
                status === "connected"
                  ? "rgba(0,229,160,0.12)"
                  : "rgba(46,53,64,0.3)",
              color: status === "connected" ? "#00e5a0" : "#2e3a4e",
              border: `1px solid ${
                status === "connected" ? "rgba(0,229,160,0.3)" : "#1e2530"
              }`,
              cursor: status === "connected" ? "pointer" : "not-allowed",
            }}
          >
            Simulate tap
          </button>
        </div>
        {lastTap && (
          <div className="mt-3 flex items-center gap-2 animate-slide-up">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                background: hexA(tapTag(lastTap.result).color, 0.1),
                color: tapTag(lastTap.result).color,
                border: `1px solid ${hexA(tapTag(lastTap.result).color, 0.2)}`,
              }}
            >
              {tapTag(lastTap.result).label}
            </span>
            <span className="text-xs" style={{ color: "#dde2ec" }}>
              {tapTag(lastTap.result).headline}
            </span>
            <span
              className="text-xs font-mono ml-auto"
              style={{ color: "#56627a" }}
            >
              {lastTap.time}
            </span>
          </div>
        )}
      </div>

      {/* Live tap feed */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #1e2530" }}
      >
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ background: "#111418", borderBottom: "1px solid #1e2530" }}
        >
          <span
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "#56627a" }}
          >
            Live tap feed
          </span>
          <span className="text-xs font-mono" style={{ color: "#2e3a4e" }}>
            {feed.length} in session
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2530" }}>
              <th
                className="text-left px-4 py-2 text-xs font-mono"
                style={{ color: "#2e3a4e" }}
              >
                Time
              </th>
              <th
                className="text-left px-4 py-2 text-xs font-mono"
                style={{ color: "#2e3a4e" }}
              >
                Card
              </th>
              <th
                className="text-left px-4 py-2 text-xs font-mono"
                style={{ color: "#2e3a4e" }}
              >
                Decision
              </th>
              <th
                className="text-left px-4 py-2 text-xs font-mono"
                style={{ color: "#2e3a4e" }}
              >
                Student
              </th>
            </tr>
          </thead>
          <tbody>
            {feed.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-8 text-xs font-mono"
                  style={{ color: "#2e3540" }}
                >
                  no taps received yet
                </td>
              </tr>
            ) : (
              feed.map((ev, i) => {
                const t = tapTag(ev.result)
                return (
                  <tr
                    key={ev.id}
                    style={{
                      borderBottom:
                        i < feed.length - 1 ? "1px solid #161b22" : "none",
                      background: "#0d1015",
                    }}
                  >
                    <td
                      className="px-4 py-2.5 text-xs font-mono"
                      style={{ color: "#56627a" }}
                    >
                      {ev.time}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs font-mono"
                      style={{ color: "#00e5a0" }}
                    >
                      {ev.cardId}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: hexA(t.color, 0.1),
                          color: t.color,
                          border: `1px solid ${hexA(t.color, 0.2)}`,
                        }}
                      >
                        {t.label}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: "#dde2ec" }}
                    >
                      {t.name}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
