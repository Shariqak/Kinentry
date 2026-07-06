import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function NavBar() {
  const { user, signOut } = useAuth()
  const [role, setRole] = useState(null)

  useEffect(() => {
    async function loadRole() {
      const { data } = await supabase
        .from('patients')
        .select('role')
        .eq('id', user.id)
        .single()
      if (data) setRole(data.role)
    }
    loadRole()
  }, [user.id])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-blue-700">enrollease</span>
          <nav className="flex gap-4">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "text-sm font-medium text-blue-600" : "text-sm font-medium text-slate-600"}>Dashboard</NavLink>
            <NavLink to="/programs" className={({ isActive }) => isActive ? "text-sm font-medium text-blue-600" : "text-sm font-medium text-slate-600"}>Programs</NavLink>
            <NavLink to="/my-enrollments" className={({ isActive }) => isActive ? "text-sm font-medium text-blue-600" : "text-sm font-medium text-slate-600"}>My Enrollments</NavLink>
            <NavLink to="/profile" className={({ isActive }) => isActive ? "text-sm font-medium text-blue-600" : "text-sm font-medium text-slate-600"}>Profile</NavLink>
            {(role === 'admin' || role === 'staff') && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? "text-sm font-medium text-red-600" : "text-sm font-medium text-red-400"}>Admin</NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button onClick={signOut} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Sign out</button>
        </div>
      </div>
    </header>
  )
}
