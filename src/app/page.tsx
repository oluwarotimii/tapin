import { redirect } from "next/navigation"
import { adminCount } from "@/lib/session"

export default async function Home() {
  if ((await adminCount()) === 0) redirect("/setup")
  // Everyone lands on the tap kiosk. Admin is password-protected at /admin.
  redirect("/terminal")
}
