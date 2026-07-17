import { useEffect, useState } from 'react'
import { PatientNavBar } from '../components/PatientNavBar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const STATUS_COLORS = {
  pending:    '#f59e0b',
  confirmed:  '#22c55e',
  waitlisted: '#3b82f6',
  cancelled:  '#94a3b8',
}

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#14b8a6', '#f97316'
]

export default function Dashboard() {
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [patRes, enrRes, progRes] = await Promise.all([
        supabase.from('patients').select('full_name, role').eq('id', user.id).single(),
        supabase.from('enrollments').select('*, programs(*)').eq('patient_id', user.id),
        supabase.from('programs').select('*'),
      ])
      if (patRes.data) setPatient(patRes.data)
      if (enrRes.data) setEnrollments(enrRes.data)
      if (progRes.data) setPrograms(progRes.data)
      setLoading(false)
    }
    loadData()
  }, [user.id])

  const active = enrollments.filter((e) => e.status !== 'cancelled')

  const statusData = Object.entries(
    enrollments.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const capacityData = programs.map((p) => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
    capacity: p.capacity,
    enrolled: enrollments.filter((e) => e.program_id === p.id && e.status !== 'cancelled').length,
  }))

  const stats = [
    { label: 'Total Enrollments', value: enrollments.length },
    { label: 'Active', value: active.length },
    { label: 'Pending', value: enrollments.filter((e) => e.status === 'pending').length },
    { label: 'Confirmed', value: enrollments.filter((e) => e.status === 'confirmed').length },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavBar />
      <div className="mx-auto max-w-5xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {patient?.full_name || user?.email}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here is a summary of your enrollment activity.
          </p>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading dashboard...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-blue-600">{s.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">Enrollment by Status</h2>
                {statusData.length === 0 ? (
                  <p className="text-sm text-slate-400">No enrollment data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#cbd5e1'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">Program Capacity vs Enrolled</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={capacityData} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="capacity" fill="#e2e8f0" name="Capacity" />
                    <Bar dataKey="enrolled" fill="#3b82f6" name="Enrolled" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Active Enrollments</h2>
              {active.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No active enrollments.{' '}
                  <a href="/patient/programs" className="text-blue-600 hover:underline">Browse programs</a>
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {active.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{e.programs.name}</p>
                        <p className="text-xs text-slate-400">{e.programs.category} · {e.programs.location}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                        e.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        e.status === 'waitlisted' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {e.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
