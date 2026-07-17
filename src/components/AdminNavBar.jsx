import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const linkClass = ({ isActive }) =>
  isActive ? "text-sm font-medium text-red-600" : "text-sm font-medium text-slate-600"

// Sections still planned next (RCM reframe) — shown as disabled placeholders
// so the target navigation structure stays visible, without dead-ending
// into pages that don't exist yet.
const COMING_SOON = ["Intake Queue", "Referrals", "Reports"]

export function AdminNavBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/staff-login")
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-red-700">Kinentry — Admin</span>
          <nav className="flex gap-4 items-center">
            <NavLink to="/admin/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/admin/patients" className={linkClass}>Patients</NavLink>
            {COMING_SOON.map((label) => (
              <span
                key={label}
                title="Coming soon"
                className="text-sm font-medium text-slate-300 cursor-not-allowed select-none"
              >
                {label}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <NavLink
            to="/patient/dashboard"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
          >
            ← Patient Portal
          </NavLink>
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button onClick={handleSignOut} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Sign out</button>
        </div>
      </div>
    </header>
  )
}
