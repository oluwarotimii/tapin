import { redirect } from "next/navigation"
import { adminCount } from "@/lib/session"
import TerminalShell from "@/components/TerminalShell"

export default async function TerminalPage() {
  if ((await adminCount()) === 0) redirect("/setup")
  return <TerminalShell />
}
