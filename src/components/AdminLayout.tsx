"use client"

import { usePathname, useRouter } from "next/navigation"
import AdminShell, { type AdminPage } from "@/components/AdminShell"

const PAGE_MAP: Record<string, AdminPage> = {
  "/admin": "overview",
  "/admin/students": "students",
  "/admin/cards": "cards",
  "/admin/schedule": "schedule",
  "/admin/log": "log",
  "/admin/devices": "devices",
  "/admin/keys": "keys",
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const router = useRouter()
  const page = PAGE_MAP[pathname] ?? "overview"

  return (
    <AdminShell
      page={page}
      onPage={(p) => router.push(`/admin${p === "overview" ? "" : `/${p}`}`)}
      onTerminal={() => router.push("/terminal")}
      onLogout={async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        router.push("/login")
      }}
    >
      {children}
    </AdminShell>
  )
}
