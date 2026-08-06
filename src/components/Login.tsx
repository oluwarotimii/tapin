import { useState } from "react"

interface LoginProps {
  onLogin: () => void
}

const ADMIN_PASSWORD = "admin123"

export default function Login({ onLogin }: LoginProps) {
  const [pw, setPw] = useState("")
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      onLogin()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPw("")
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#0a0c0f" }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,37,48,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,37,48,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(0,229,160,0.12)",
              border: "1px solid rgba(0,229,160,0.3)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="#00e5a0" />
              <rect
                x="16"
                y="4"
                width="8"
                height="8"
                rx="1.5"
                fill="#00e5a0"
                opacity="0.4"
              />
              <rect
                x="4"
                y="16"
                width="8"
                height="8"
                rx="1.5"
                fill="#00e5a0"
                opacity="0.4"
              />
              <rect
                x="16"
                y="16"
                width="8"
                height="8"
                rx="1.5"
                fill="#00e5a0"
                opacity="0.7"
              />
            </svg>
          </div>
          <div className="text-center">
            <div
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "#dde2ec" }}
            >
              TapIn
            </div>
            <div
              className="text-xs font-mono mt-0.5"
              style={{ color: "#56627a" }}
            >
              SOLO ATTENDANCE SYSTEM
            </div>
          </div>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className={`w-80 rounded-xl p-6 flex flex-col gap-4 ${
            shake ? "animate-[wiggle_0.4s_ease-in-out]" : ""
          }`}
          style={{
            background: "#111418",
            border: "1px solid #1e2530",
            transform: shake ? undefined : "none",
          }}
        >
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: "#56627a" }}
            >
              Admin Password
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value)
                setError(false)
              }}
              placeholder="••••••••"
              autoFocus
              className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
              style={{
                background: "#181c22",
                border: `1px solid ${error ? "#ff4d6a" : "#1e2530"}`,
                color: "#dde2ec",
                caretColor: "#00e5a0",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = error
                  ? "#ff4d6a"
                  : "#2e3540"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = error
                  ? "#ff4d6a"
                  : "#1e2530"
              }}
            />
            {error && (
              <div
                className="text-xs font-mono animate-slide-up"
                style={{ color: "#ff4d6a" }}
              >
                incorrect password
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "#00e5a0",
              color: "#0a0c0f",
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#00ffb3")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#00e5a0")}
          >
            Sign In
          </button>

          <div
            className="text-center text-xs font-mono"
            style={{ color: "#56627a" }}
          >
            hint: admin123
          </div>
        </form>

        <div className="text-xs font-mono" style={{ color: "#2e3540" }}>
          v1.0 · solo terminal
        </div>
      </div>
    </div>
  )
}
