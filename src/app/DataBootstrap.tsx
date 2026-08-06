"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { db, isLoaded } from "@/store"

const NO_DATA_ROUTES = ["/login", "/setup"]

export default function DataBootstrap({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const [ready, setReady] = useState(isLoaded())

  useEffect(() => {
    let cancelled = false
    const noData = NO_DATA_ROUTES.includes(pathname ?? "")
    if (noData) return
    db.load()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        db.load().catch(() => {})
      }
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [pathname])

  const needsData = !NO_DATA_ROUTES.includes(pathname ?? "")

  if (needsData && !ready) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "#0a0c0f" }}
      >
        <div
          className="w-3 h-3 rounded-full animate-pulse-ring"
          style={{ background: "#00e5a0" }}
        />
        <div className="mt-4 text-xs font-mono" style={{ color: "#56627a" }}>
          tapin · loading…
        </div>
      </div>
    )
  }

  return <>{children}</>
}
