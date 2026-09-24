"use client"

import { useEffect, useState } from "react"

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  active: boolean
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
}

const SCOPE_LABELS: Record<string, string> = {
  students_read: "students:read",
  students_write: "students:write",
  schedules_read: "schedules:read",
  schedules_write: "schedules:write",
  attendance_read: "attendance:read",
  attendance_write: "attendance:write",
  taps_write: "taps:write",
  cards_write: "cards:write",
  fingerprints_write: "fingerprints:write",
}

const SCOPE_COLORS: Record<string, string> = {
  students_read: "#4d9fff",
  students_write: "#00e5a0",
  schedules_read: "#4d9fff",
  schedules_write: "#00e5a0",
  attendance_read: "#4d9fff",
  attendance_write: "#00e5a0",
  taps_write: "#ffb03a",
  cards_write: "#ffb03a",
  fingerprints_write: "#ffb03a",
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Set<string>>(new Set(["students_read", "attendance_read", "attendance_write", "taps_write"]))
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")

  async function refresh() {
    const res = await fetch("/api/keys")
    const j = await res.json()
    if (res.ok) setKeys(j.keys)
  }

  useEffect(() => {
    refresh()
  }, [])

  function toggleScope(s: string) {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  async function handleCreate() {
    setError("")
    if (!name.trim() || scopes.size === 0) {
      setError("Name and at least one scope are required")
      return
    }
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scopes: [...scopes] }),
    })
    const j = await res.json()
    if (!res.ok) {
      setError(j.error ?? "failed to create key")
      return
    }
    setCreatedKey(j.api_key)
    setShowCreate(false)
    setName("")
    await refresh()
  }

  async function handleToggle(k: ApiKeyRow) {
    await fetch(`/api/keys/${k.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !k.active }),
    })
    await refresh()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" })
    setMsg("Key revoked")
    setTimeout(() => setMsg(""), 2000)
    await refresh()
  }

  function copyKey() {
    if (!createdKey) return
    navigator.clipboard?.writeText(createdKey)
    setMsg("Key copied")
    setTimeout(() => setMsg(""), 2000)
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#dde2ec" }}>
            API Keys
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#56627a" }}>
            scoped keys for LMS &amp; external integrations — authorize with `Bearer tp_…`
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="text-xs font-mono px-3 py-2 rounded-lg transition-all"
          style={{ background: "rgba(0,229,160,0.1)", color: "#00e5a0", border: "1px solid rgba(0,229,160,0.3)" }}
        >
          {showCreate ? "Cancel" : "+ New Key"}
        </button>
      </div>

      {msg && (
        <div className="mb-4 text-xs font-mono animate-slide-up" style={{ color: "#00e5a0" }}>
          {msg}
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl p-5 mb-6 animate-slide-up" style={{ background: "#111418", border: "1px solid #1e2530" }}>
          <div className="flex flex-col gap-1 mb-4">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
              Key name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LMS integration"
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ background: "#181c22", border: "1px solid #1e2530", color: "#dde2ec", caretColor: "#00e5a0" }}
            />
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "#56627a" }}>
              Scopes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SCOPE_LABELS).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => toggleScope(s)}
                  className="text-xs font-mono px-2.5 py-1 rounded transition-all"
                  style={{
                    background: scopes.has(s) ? `${SCOPE_COLORS[s]}18` : "#181c22",
                    color: scopes.has(s) ? SCOPE_COLORS[s] : "#56627a",
                    border: `1px solid ${scopes.has(s) ? `${SCOPE_COLORS[s]}40` : "#1e2530"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 text-xs font-mono" style={{ color: "#ff4d6a" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            className="text-xs font-mono px-3 py-2 rounded-lg transition-all"
            style={{ background: "#00e5a0", color: "#0a0c0f" }}
          >
            Create Key
          </button>
        </div>
      )}

      {createdKey && (
        <div className="rounded-xl p-5 mb-6 animate-slide-up" style={{ background: "#111418", border: "1px solid rgba(0,229,160,0.3)" }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#00e5a0" }}>
            Key created — copy it now, it won&apos;t be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono px-3 py-2 rounded break-all" style={{ background: "#0a0c0f", border: "1px solid #1e2530", color: "#dde2ec" }}>
              {createdKey}
            </code>
            <button
              onClick={copyKey}
              className="text-xs font-mono px-3 py-2 rounded"
              style={{ background: "#181c22", color: "#00e5a0", border: "1px solid rgba(0,229,160,0.3)" }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl" style={{ background: "#111418", border: "1px solid #1e2530" }}>
        {keys.length === 0 && (
          <div className="px-5 py-8 text-center text-xs font-mono" style={{ color: "#56627a" }}>
            No API keys yet. Create one to let external apps connect.
          </div>
        )}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e2530" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate" style={{ color: "#dde2ec" }}>
                  {k.name}
                </span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: k.active ? "#00e5a015" : "#ff4d6a15",
                    color: k.active ? "#00e5a0" : "#ff4d6a",
                    border: `1px solid ${k.active ? "#00e5a030" : "#ff4d6a30"}`,
                  }}
                >
                  {k.active ? "active" : "revoked"}
                </span>
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: "#2e3a4e" }}>
                {k.prefix}…
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {k.scopes.map((s) => (
                  <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#181c22", color: SCOPE_COLORS[s] ?? "#56627a", border: "1px solid #1e2530" }}>
                    {SCOPE_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(k)}
                className="text-xs font-mono px-2.5 py-1.5 rounded"
                style={{ background: "#181c22", color: k.active ? "#ffb03a" : "#00e5a0", border: "1px solid #1e2530" }}
              >
                {k.active ? "Revoke" : "Re-enable"}
              </button>
              <button
                onClick={() => handleDelete(k.id)}
                className="text-xs font-mono px-2.5 py-1.5 rounded"
                style={{ background: "#181c22", color: "#ff4d6a", border: "1px solid #1e2530" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
