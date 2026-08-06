import { useState } from "react"
import Login from "./components/Login"
import Terminal from "./components/Terminal"
import AdminShell, { type AdminPage } from "./components/AdminShell"
import Dashboard from "./components/Dashboard"
import Students from "./components/Students"
import Cards from "./components/Cards"
import Schedule from "./components/Schedule"
import AttendanceLog from "./components/AttendanceLog"
import Devices from "./components/Devices"

type View = "login" | "terminal" | "admin"

export default function App() {
  const [view, setView] = useState<View>("login")
  const [adminPage, setAdminPage] = useState<AdminPage>("overview")

  if (view === "login") {
    return <Login onLogin={() => setView("terminal")} />
  }

  if (view === "terminal") {
    return <Terminal onAdminClick={() => setView("admin")} />
  }

  return (
    <AdminShell
      page={adminPage}
      onPage={setAdminPage}
      onTerminal={() => setView("terminal")}
      onLogout={() => setView("login")}
    >
      {adminPage === "overview" && <Dashboard />}
      {adminPage === "students" && <Students />}
      {adminPage === "cards" && <Cards />}
      {adminPage === "schedule" && <Schedule />}
      {adminPage === "log" && <AttendanceLog />}
      {adminPage === "devices" && <Devices />}
    </AdminShell>
  )
}
