import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import AdminLayout from "@/components/AdminLayout"

export default async function AdminLayoutPage({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return <AdminLayout>{children}</AdminLayout>
}
