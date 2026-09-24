"use client"

import { type ReactNode } from "react"

export type AdminPage =
  | "overview"
  | "students"
  | "cards"
  | "fingerprints"
  | "schedule"
  | "log"
  | "devices"
  | "keys"

interface AdminShellProps {
  page: AdminPage
  onPage: (p: AdminPage) => void
  onTerminal: () => void
  onLogout: () => void
  children: ReactNode
}

const NAV: { id: AdminPage; label: string; icon: ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M1.5 8h2.5l2-4.5 2.5 7 2-4 1.5 1.5h2.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "students",
    label: "Students",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "cards",
    label: "Cards",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="1.5"
          y="4"
          width="13"
          height="8.5"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <rect
          x="3"
          y="5.5"
          width="3"
          height="3"
          rx="0.5"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="8"
          y1="6.5"
          x2="12.5"
          y2="6.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="8.5"
          x2="11"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "fingerprints",
    label: "Fingerprints",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5v1.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M8 4.5a3.5 3.5 0 0 1 3.5 3.5v1.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M2.5 8a5.5 5.5 0 0 1 2.2-4.4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M8 6.5a1.5 1.5 0 0 1 1.5 1.5v2.5a3 3 0 0 1-3 3"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M4.7 5.3A3.5 3.5 0 0 0 4.5 8v2a4.5 4.5 0 0 0 1 2.8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="1.5"
          y="2.5"
          width="13"
          height="11"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <line
          x1="1.5"
          y1="5.5"
          x2="14.5"
          y2="5.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <line
          x1="5"
          y1="1"
          x2="5"
          y2="4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <line
          x1="11"
          y1="1"
          x2="11"
          y2="4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "log",
    label: "Attendance Log",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="2"
          y="1.5"
          width="9.5"
          height="13"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <line
          x1="4.5"
          y1="5"
          x2="9"
          y2="5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="4.5"
          y1="7.5"
          x2="9"
          y2="7.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="4.5"
          y1="10"
          x2="7"
          y2="10"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle
          cx="12.5"
          cy="12.5"
          r="2.5"
          fill="#0a0c0f"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <line
          x1="12.5"
          y1="11.5"
          x2="12.5"
          y2="12.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="12.5"
          y1="12.5"
          x2="13.5"
          y2="12.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "devices",
    label: "Devices",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 5.5a8 8 0 0 1 11 0"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M4.5 8a5.5 5.5 0 0 1 7 0"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <circle cx="8" cy="10.5" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "keys",
    label: "API Keys",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle
          cx="6"
          cy="10"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d="M8 10h5.5v2M11.5 10V7M9 8.5h.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export default function AdminShell({
  page,
  onPage,
  onTerminal,
  onLogout,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen flex" style={{ background: "#0a0c0f" }}>
      {/* Sidebar */}
      <div
        className="w-52 shrink-0 flex flex-col"
        style={{ background: "#0d1015", borderRight: "1px solid #1e2530" }}
      >
        {/* Logo */}
        <div
          className="px-4 py-4"
          style={{ borderBottom: "1px solid #1e2530" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "rgba(0,229,160,0.1)",
                border: "1px solid rgba(0,229,160,0.2)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="4"
                  height="4"
                  rx="0.75"
                  fill="#00e5a0"
                />
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
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "#dde2ec" }}
              >
                TapIn
              </div>
              <div className="text-xs font-mono" style={{ color: "#2e3a4e" }}>
                admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.id === page
            return (
              <button
                key={item.id}
                onClick={() => onPage(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left"
                style={{
                  background: active ? "rgba(0,229,160,0.08)" : "transparent",
                  color: active ? "#00e5a0" : "#56627a",
                  border: active
                    ? "1px solid rgba(0,229,160,0.15)"
                    : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "#dde2ec"
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "#56627a"
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-2 py-3 flex flex-col gap-0.5"
          style={{ borderTop: "1px solid #1e2530" }}
        >
          <button
            onClick={onTerminal}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: "#56627a" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00e5a0"
              e.currentTarget.style.background = "rgba(0,229,160,0.06)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#56627a"
              e.currentTarget.style.background = "transparent"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="1.5"
                y="3"
                width="13"
                height="10"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <line
                x1="5"
                y1="15"
                x2="11"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="13"
                x2="8"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
            <span>Terminal</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: "#56627a" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ff4d6a"
              e.currentTarget.style.background = "rgba(255,77,106,0.06)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#56627a"
              e.currentTarget.style.background = "transparent"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10.5 5.5L13.5 8m0 0L10.5 10.5M13.5 8H6"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
