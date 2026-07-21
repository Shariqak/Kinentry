import { NavLink } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const linkClass = ({ isActive }) =>
  isActive ? "text-sm font-medium text-blue-600" : "text-sm font-medium text-slate-600"

export function PatientNavBar() {
  const { user, signOut } = useAuth()
  const [role, setRole] = useState(null)

  useEffect(() => {
    async function loadRole() {
      const { data } = await supabase.from("patients").select("role").eq("id", user.id).single()
      if (data) setRole(data.role)
    }
    loadRole()
  }, [user.id])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-blue-700">Kinentry</span>
          <nav className="flex gap-4">
            <NavLink to="/patient/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/patient/programs" className={linkClass}>Programs</NavLink>
            <NavLink to="/patient/appointments" className={linkClass}>Appointments</NavLink>
            <NavLink to="/patient/my-enrollments" className={linkClass}>My Enrollments</NavLink>
            <NavLink to="/patient/profile" className={linkClass}>Profile</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {(role === "admin" || role === "staff") && (
            <NavLink
              to="/admin/dashboard"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Switch to Admin →
            </NavLink>
          )}
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button onClick={signOut} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Sign out</button>
        </div>
      </div>
    </header>
  )
}
