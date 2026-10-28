"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db, type TapResult } from "../store";
import { reader, type TapEvent } from "../reader";
import {
  useReaderStatus,
  useFingerprintBridgeConnected,
  useWcopyAutoTap,
  useWcopyBridgeConnected,
} from "../hooks";
import { useHidCapture } from "../useHidCapture";
import { useAppSettings } from "../hooks/useAppSettings";
import { tapTag, hexA } from "../tapFormat";
import type { Student } from "../lib/types";
import FingerprintEnroll from "./FingerprintEnroll";
import FingerprintScan from "./FingerprintScan";

const CLEAR_DELAY = 2800; // ms before status resets to idle

export default function Terminal() {
  const [now, setNow] = useState(new Date());
  const [lastTap, setLastTap] = useState<TapResult | null>(null);
  const [tapKey, setTapKey] = useState(0);
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [fingerprintTarget, setFingerprintTarget] = useState<Student | null>(null);
  const [codeError, setCodeError] = useState("");
  const codeErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerStatus = useReaderStatus();
  const fingerprintBridgeConnected = useFingerprintBridgeConnected();
  const wcopyBridgeConnected = useWcopyBridgeConnected();
  const settings = useAppSettings();
  const cardEnabled = settings.cardEnabled;
  const fingerprintEnabled = settings.fingerprintEnabled;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Process a card read coming from the physical HID dongle. The card detail
  // is kept hidden — only the outcome is shown.
  const performTap = useCallback(
    async (cardId: string) => {
      if (!cardEnabled) return;
      if (scanning || readerStatus !== "connected") return;
      setScanning(true);
      await reader.submitCardTap(cardId);
      setScanning(false);
    },
    [cardEnabled, scanning, readerStatus],
  );

  // A 4-digit code looks up the student directly (school IDs are always 4
  // digits) and opens the fingerprint scan — no search step, no extra
  // button press. Card swipes ("CARD-..." — always starts with a letter)
  // still go through the same input, masked, terminated by Enter, exactly
  // as before; see useHidCapture.ts for the disambiguation.
  const handleCode = useCallback(
    (code: string) => {
      if (!fingerprintEnabled) return;
      if (codeErrorTimer.current) clearTimeout(codeErrorTimer.current);
      if (!fingerprintBridgeConnected) {
        setCodeError("Fingerprint scanner not connected");
        codeErrorTimer.current = setTimeout(() => setCodeError(""), 3000);
        return;
      }
      const student = db.getStudents().find((s) => s.studentId === code);
      if (!student) {
        setCodeError(`No student found with ID ${code}`);
        codeErrorTimer.current = setTimeout(() => setCodeError(""), 3000);
        return;
      }
      setCodeError("");
      setFingerprintTarget(student);
    },
    [fingerprintEnabled, fingerprintBridgeConnected],
  );

  const { inputRef, handleKeyDown, displayValue } = useHidCapture({
    enabled: readerStatus === "connected" && (cardEnabled || fingerprintEnabled),
    onCard: (cardId) => performTap(cardId),
    onCode: handleCode,
    codeLength: 4,
  });

  // wCopy USB reader (reverse-engineered — docs/fingerprint-integration.md
  // style local bridge, see wcopy-bridge/). Independent of the HID
  // keyboard-wedge path above; both feed the same reader.submitCardTap
  // pipeline, so either physical reader can be plugged in.
  useWcopyAutoTap(readerStatus === "connected" && cardEnabled);

  useEffect(() => {
    return reader.subscribeTaps((ev) => {
      setLastTap(ev.result);
      setTapKey((k) => k + 1);
      setEvents((prev) => [ev, ...prev].slice(0, 50));
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setLastTap(null), CLEAR_DELAY);
    });
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeDisplay = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateDisplay = now.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tag = lastTap ? tapTag(lastTap) : null;
  const statusColor = tag ? tag.color : "#2e3540";
  const statusBg = tag ? hexA(tag.color, 0.08) : "rgba(46,53,64,0.12)";

  const activeStudents = db.getStudents().filter((s) => db.isClocked(s.id));

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
          {/* Hardware status — one pill per active input mode, driven by the
              real connectivity signal (wcopy-bridge / fingerprint bridge),
              not the manual kiosk-armed toggle (readerStatus still gates
              actual tap handling below, it's just no longer shown here). */}
          {cardEnabled && (
            <div
              className="hidden sm:flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
              style={{
                background: hexA(wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a", 0.08),
                color: wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a",
                border: `1px solid ${hexA(wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a", 0.25)}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                <path
                  d="M3 7.5a6.5 6.5 0 0 1 12 0"
                  stroke={wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a"}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M5.3 9a3.8 3.8 0 0 1 7.4 0"
                  stroke={wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a"}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle
                  cx="9"
                  cy="11.2"
                  r="1.1"
                  fill={wcopyBridgeConnected ? "#00e5a0" : "#ff4d6a"}
                />
              </svg>
              NFC READER {wcopyBridgeConnected ? "CONNECTED" : "NOT FOUND"}
            </div>
          )}
          {fingerprintEnabled && (
            <div
              className="hidden sm:flex items-center gap-2 mono text-xs px-3 py-1 rounded-full"
              style={{
                background: hexA(fingerprintBridgeConnected ? "#00e5a0" : "#ff4d6a", 0.08),
                color: fingerprintBridgeConnected ? "#00e5a0" : "#ff4d6a",
                border: `1px solid ${hexA(fingerprintBridgeConnected ? "#00e5a0" : "#ff4d6a", 0.25)}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: fingerprintBridgeConnected ? "#00e5a0" : "#ff4d6a",
                  boxShadow: fingerprintBridgeConnected ? "0 0 4px #00e5a0" : "none",
                }}
              />
              FINGERPRINT {fingerprintBridgeConnected ? "CONNECTED" : "NOT FOUND"}
            </div>
          )}
          <span className="mono text-xs" style={{ color: "#56627a" }}>
            {dateDisplay}
          </span>
          {fingerprintEnabled && (
            <button
              onClick={() => setShowEnroll(true)}
              className="hidden sm:flex items-center gap-1.5 mono text-xs px-3 py-1 rounded-full transition-all"
              style={{
                background: "rgba(0,229,160,0.08)",
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.2)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 2.5a6 6 0 0 1 6 6v1.5"
                  stroke="#00e5a0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M9 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3"
                  stroke="#00e5a0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M5.2 5.8A4 4 0 0 0 5 8.5v2a5 5 0 0 0 1.2 3.2"
                  stroke="#00e5a0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Enroll Fingerprint
            </button>
            )}
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

            <div
              className="rounded-full flex flex-col items-center justify-center select-none"
              style={{
                width: 190,
                height: 190,
                background: statusBg,
                border: `2px solid ${statusColor}`,
                transition: "background 0.25s, border-color 0.25s",
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
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-3">
                    {cardEnabled && (
                      <svg width="44" height="44" viewBox="0 0 18 18" fill="none">
                        {/* NFC/contactless icon */}
                        <path
                          d="M3 7.5a6.5 6.5 0 0 1 12 0"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M5.3 9a3.8 3.8 0 0 1 7.4 0"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M7.6 10.5a1.4 1.4 0 0 1 2.8 0"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="12.2" r="1" fill={statusColor} />
                      </svg>
                    )}
                    {fingerprintEnabled && (
                      <svg width="44" height="44" viewBox="0 0 18 18" fill="none">
                        {/* fingerprint icon */}
                        <path
                          d="M9 2.5a6 6 0 0 1 6 6v1.5"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 4.5a4 4 0 0 1 4 4v2"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M3 9a6 6 0 0 1 2.5-4.9"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M5.2 5.8A4 4 0 0 0 5 8.5v2a5 5 0 0 0 1.2 3.2"
                          stroke={statusColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className="mono text-sm mt-2"
                    style={{ color: statusColor }}
                  >
                    {readerStatus !== "connected"
                      ? "READER OFFLINE"
                      : lastTap
                      ? "TAP AGAIN"
                      : cardEnabled && fingerprintEnabled
                      ? "TAP CARD OR TYPE ID"
                      : cardEnabled
                      ? "TAP CARD"
                      : fingerprintEnabled
                      ? "TYPE ID FOR FINGERPRINT"
                      : "SYSTEM DISABLED"}
                  </span>
                </div>
              )}
            </div>
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
                  : cardEnabled && fingerprintEnabled
                  ? fingerprintBridgeConnected
                    ? "tap your card, or type your 4-digit ID below"
                    : "tap your card, or type your 4-digit ID below"
                  : cardEnabled
                  ? "tap your card"
                  : fingerprintEnabled
                  ? fingerprintBridgeConnected
                    ? "type your 4-digit ID to verify by fingerprint"
                    : "fingerprint scanner not connected"
                  : "system disabled — enable card or fingerprint in admin"}
              </div>
            )}
          </div>

{(cardEnabled || fingerprintEnabled) && (
            <div className="flex flex-col items-center gap-2">
              <input
                ref={inputRef}
                value={displayValue}
                readOnly
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={handleKeyDown}
                placeholder={cardEnabled && fingerprintEnabled ? "– – – –" : cardEnabled ? "CARD" : "– – – –"}
                className="mono text-center text-2xl tracking-[0.4em] rounded-xl outline-none"
                style={{
                  width: 220,
                  padding: "10px 0",
                  background: "#111418",
                  border: `1px solid ${codeError ? "rgba(255,77,106,0.5)" : "#1e2530"}`,
                  color: "#dde2ec",
                  caretColor: "#00e5a0",
                }}
              />
              <span
                className="mono text-xs"
                style={{ color: codeError ? "#ff4d6a" : "#56627a" }}
              >
                {codeError ||
                  (fingerprintEnabled
                    ? fingerprintBridgeConnected
                      ? "type your 4-digit ID to verify by fingerprint"
                      : "fingerprint scanner not connected"
                    : cardEnabled
                    ? "tap your card"
                    : "system disabled")}
              </span>
            </div>
            )}
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
                  const t = tapTag(ev.result);
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {fingerprintEnabled && showEnroll && <FingerprintEnroll onClose={() => setShowEnroll(false)} />}
      {fingerprintEnabled && fingerprintTarget && (
        <FingerprintScan
          student={fingerprintTarget}
          onClose={() => setFingerprintTarget(null)}
        />
      )}
    </div>
  );
}
