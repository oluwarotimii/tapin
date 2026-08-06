"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { db, type TapResult } from "../store"
import { reader, type TapEvent } from "../reader"
import { useReaderStatus } from "../hooks"
import { tapTag, hexA } from "../tapFormat"

// Demo cards that cycle through real students + one unknown
const DEMO_CARDS = [
  "CARD-A1B2",
  "CARD-C3D4",
  "CARD-E5F6",
  "CARD-A1B2",
  "CARD-XXXX",
  "CARD-C3D4",
]
const CLEAR_DELAY = 2800 // ms before status resets to idle

const READER_STATUS: Record<string, { label: string; color: string }> = {
  disconnected: { label: "OFFLINE", color: "#ff4d6a" },
  connecting: { label: "CONNECTING", color: "#ffb03a" },
  connected: { label: "ONLINE", color: "#00e5a0" },
  error: { label: "ERROR", color: "#ff4d6a" },
}

export default function Terminal() {
  const [now, setNow] = useState(new Date())
  const [lastTap, setLastTap] = useState<TapResult | null>(null)
  const [tapKey, setTapKey] = useState(0)
  const [events, setEvents] = useState<TapEvent[]>([])
  const [scanning, setScanning] = useState(false)
  const [demoIdx, setDemoIdx] = useState(0)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readerStatus = useReaderStatus()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return reader.subscribeTaps((ev) => {
      setLastTap(ev.result)
      setTapKey((k) => k + 1)
      setEvents((prev) => [ev, ...prev].slice(0, 50))
      if (clearTimer.current) clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => setLastTap(null), CLEAR_DELAY)
    })
  }, [])

  const pad = (n: number) => String(n).padStart(2, "0")
  const timeDisplay = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const dateDisplay = now.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const todaySchedule = (() => {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]
    return db.getSchedule().find((s) => s.day === days[now.getDay()])
  })()

  const handleDemoTap = useCallback(() => {
    if (scanning || readerStatus !== "connected") return
    setScanning(true)
    const card = DEMO_CARDS[demoIdx % DEMO_CARDS.length]
    setDemoIdx((i) => i + 1)
    setTimeout(() => {
      reader.simulateTap(card)
      setScanning(false)
    }, 180)
  }, [scanning, readerStatus, demoIdx])

  const rs = READER_STATUS[readerStatus] ?? READER_STATUS.disconnected
  const tag = lastTap ? tapTag(lastTap) : null
  const statusColor = tag ? tag.color : "#2e3540"
  const statusBg = tag ? hexA(tag.color, 0.08) : "rgba(46,53,64,0.12)"

  const activeStudents = db.getStudents().filter((s) => db.isClocked(s.id))

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#0a0c0f",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* scanline texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
          zIndex: 1,
        }}
      />
      {/* grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,37,48,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(30,37,48,0.2) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          zIndex: 1,
        }}
      />

      {/* ── top bar ── */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid #1e2530" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(0,229,160,0.1)",
              border: "1px solid rgba(0,229,160,0.2)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="0.75" fill="#00e5a0" />
              <rect
                x="9"
                y="1"
                width="4"
                height="4"
                rx="0.75"
                fill="#00e5a0"
                opacity="0.4"
              />
              <rect
                x="1"
                y="9"
                width="4"
                height="4"
                rx="0.75"
                fill="#00e5a0"
                opacity="0.4"
              />
              <rect
                x="9"
                y="9"
                width="4"
                height="4"
                rx="0.75"
                fill="#00e5a0"
                opacity="0.7"
              />
            </svg>
          </div>
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: "#dde2ec" }}
          >
            TapIn
          </span>
          <span
            className="mono text-xs px-2 py-0.5 rounded"
            style={{
              background: "#111418",
              color: "#56627a",
              border: "1px solid #1e2530",
            }}
          >
            TERMINAL
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* reader status pill */}
          <div
            className="hidden sm:flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
            style={{
              background: hexA(rs.color, 0.08),
              color: rs.color,
              border: `1px solid ${hexA(rs.color, 0.25)}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: rs.color,
                boxShadow:
                  readerStatus === "connected" ? `0 0 4px ${rs.color}` : "none",
              }}
            />
            READER {rs.label}
          </div>
          {/* today's schedule pill */}
          {todaySchedule ? (
            <div
              className="hidden sm:flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
              style={{
                background: "rgba(0,229,160,0.08)",
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.2)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#00e5a0", boxShadow: "0 0 4px #00e5a0" }}
              />
              {todaySchedule.start} – {todaySchedule.end} · min{" "}
              {todaySchedule.minimumMinutes}m
            </div>
          ) : (
            <div
              className="hidden sm:flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
              style={{
                background: "rgba(255,77,106,0.08)",
                color: "#ff4d6a",
                border: "1px solid rgba(255,77,106,0.2)",
              }}
            >
              No schedule today
            </div>
          )}
          <span className="mono text-xs" style={{ color: "#56627a" }}>
            {dateDisplay}
          </span>
        </div>
      </div>

      {/* ── main layout ── */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* ── centre: tap zone ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-10">
          {/* clock */}
          <div
            className="mono text-7xl lg:text-8xl font-light tabular-nums tracking-tighter"
            style={{ color: "#dde2ec", letterSpacing: "-0.04em" }}
          >
            {timeDisplay}
          </div>

          {/* tap button */}
          <div className="relative flex items-center justify-center my-4">
            {/* pulse rings */}
            {lastTap && (
              <>
                <div
                  className="absolute rounded-full animate-pulse-ring"
                  style={{
                    width: 230,
                    height: 230,
                    border: `1px solid ${statusColor}`,
                    opacity: 0.35,
                  }}
                />
                <div
                  className="absolute rounded-full animate-pulse-ring"
                  style={{
                    width: 270,
                    height: 270,
                    border: `1px solid ${statusColor}`,
                    opacity: 0.15,
                    animationDelay: "0.35s",
                  }}
                />
              </>
            )}

            <button
              onClick={handleDemoTap}
              disabled={scanning || readerStatus !== "connected"}
              className="rounded-full flex flex-col items-center justify-center select-none transition-all"
              style={{
                width: 190,
                height: 190,
                background: statusBg,
                border: `2px solid ${statusColor}`,
                cursor: scanning
                  ? "wait"
                  : readerStatus !== "connected"
                    ? "not-allowed"
                    : "pointer",
                transition: "background 0.25s, border-color 0.25s",
              }}
              onMouseEnter={(e) => {
                if (!lastTap && readerStatus === "connected")
                  e.currentTarget.style.borderColor = "#00e5a0"
              }}
              onMouseLeave={(e) => {
                if (!lastTap) e.currentTarget.style.borderColor = "#2e3540"
              }}
            >
              {scanning ? (
                <svg
                  className="animate-spin"
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#2e3540"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="#00e5a0"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <>
                  {/* NFC icon */}
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <rect
                      x="6"
                      y="6"
                      width="13"
                      height="13"
                      rx="2.5"
                      stroke={statusColor}
                      strokeWidth="1.5"
                    />
                    <rect
                      x="25"
                      y="6"
                      width="13"
                      height="13"
                      rx="2.5"
                      stroke={statusColor}
                      strokeWidth="1.5"
                      opacity="0.45"
                    />
                    <rect
                      x="6"
                      y="25"
                      width="13"
                      height="13"
                      rx="2.5"
                      stroke={statusColor}
                      strokeWidth="1.5"
                      opacity="0.45"
                    />
                    <rect
                      x="29"
                      y="29"
                      width="5"
                      height="5"
                      rx="1"
                      fill={statusColor}
                    />
                    <rect
                      x="25"
                      y="25"
                      width="5"
                      height="5"
                      rx="1"
                      fill={statusColor}
                      opacity="0.4"
                    />
                    <rect
                      x="33"
                      y="25"
                      width="5"
                      height="5"
                      rx="1"
                      fill={statusColor}
                      opacity="0.4"
                    />
                    <rect
                      x="25"
                      y="33"
                      width="5"
                      height="5"
                      rx="1"
                      fill={statusColor}
                      opacity="0.4"
                    />
                    <rect
                      x="33"
                      y="33"
                      width="5"
                      height="5"
                      rx="1"
                      fill={statusColor}
                      opacity="0.4"
                    />
                  </svg>
                  <span
                    className="mono text-sm mt-2"
                    style={{ color: statusColor }}
                  >
                    {readerStatus !== "connected"
                      ? "READER OFFLINE"
                      : lastTap
                        ? "TAP AGAIN"
                        : "TAP CARD"}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* status message */}
          <div
            className="text-center h-16 flex flex-col items-center justify-center"
            key={tapKey}
          >
            {tag ? (
              <div className="animate-slide-up flex flex-col items-center gap-1">
                <div
                  className="text-2xl font-semibold"
                  style={{ color: tag.color }}
                >
                  {tag.headline}
                </div>
                <div className="text-base" style={{ color: "#dde2ec" }}>
                  {tag.sub}
                </div>
              </div>
            ) : (
              <div className="mono text-sm" style={{ color: "#2e3540" }}>
                {readerStatus !== "connected"
                  ? "reader offline"
                  : "hold card near reader"}
              </div>
            )}
          </div>

          {/* demo hint */}
          <div
            className="mono text-xs px-3 py-1 rounded"
            style={{ color: "#2e3a4e", border: "1px solid #1a2028" }}
          >
            demo — click circle to simulate a tap
          </div>
        </div>

        {/* ── right panel ── */}
        <div
          className="hidden lg:flex w-64 flex-col"
          style={{ borderLeft: "1px solid #1e2530" }}
        >
          {/* currently in */}
          <div style={{ borderBottom: "1px solid #1e2530" }}>
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ borderBottom: "1px solid #1e2530" }}
            >
              <span
                className="mono text-xs uppercase tracking-widest"
                style={{ color: "#56627a" }}
              >
                In session
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: activeStudents.length ? "#00e5a0" : "#2e3540",
                  boxShadow: activeStudents.length ? "0 0 5px #00e5a0" : "none",
                }}
              />
              <span
                className="mono text-xs ml-auto"
                style={{ color: "#2e3a4e" }}
              >
                {activeStudents.length}
              </span>
            </div>
            <div className="px-4 py-2 max-h-40 overflow-y-auto">
              {activeStudents.length === 0 ? (
                <div className="mono text-xs py-2" style={{ color: "#2e3540" }}>
                  none clocked in
                </div>
              ) : (
                activeStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1">
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ background: "#00e5a0" }}
                    />
                    <span
                      className="text-xs truncate"
                      style={{ color: "#dde2ec" }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="mono text-xs ml-auto"
                      style={{ color: "#2e3a4e" }}
                    >
                      {s.studentId}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* event log */}
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid #1e2530" }}
            >
              <span
                className="mono text-xs uppercase tracking-widest"
                style={{ color: "#56627a" }}
              >
                Recent taps
              </span>
              <span className="mono text-xs" style={{ color: "#2e3a4e" }}>
                {events.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div
                  className="flex items-center justify-center h-20 mono text-xs"
                  style={{ color: "#2e3540" }}
                >
                  no events yet
                </div>
              ) : (
                events.map((ev) => {
                  const t = tapTag(ev.result)
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2 px-4 py-2 animate-fade-in"
                      style={{ borderBottom: "1px solid #161b22" }}
                    >
                      <span
                        className="mono text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: hexA(t.color, 0.1),
                          color: t.color,
                          border: `1px solid ${hexA(t.color, 0.2)}`,
                        }}
                      >
                        {t.label}
                      </span>
                      <span
                        className="text-xs truncate flex-1"
                        style={{ color: "#dde2ec" }}
                      >
                        {t.name}
                      </span>
                      <span
                        className="mono text-xs shrink-0"
                        style={{ color: "#56627a" }}
                      >
                        {ev.time}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
