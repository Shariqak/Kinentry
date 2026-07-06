import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar } from '../components/NavBar'
import { Navigate } from 'react-router-dom'

const STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-800',
  confirmed:  'bg-green-100 text-green-800',
  waitlisted: 'bg-blue-100 text-blue-800',
  cancelled:  'bg-slate-100 text-slate-500',
}

export default function Admin() {
  const { user } = useAuth()
  const [role, setRole] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [filterProgram, setFilterProgram] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    async function loadData() {
      const { data: patient } = await supabase
        .from('patients')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(patient?.role)

      const [enrRes, progRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('*, patients(full_name, phone), programs(name, category, capacity)')
          .order('enrolled_at', { ascending: false }),
        supabase.from('programs').select('*').order('name'),
      ])

      if (enrRes.data) setEnrollments(enrRes.data)
      if (progRes.data) setPrograms(progRes.data)
      setLoading(false)
    }
    loadData()
  }, [user.id])

  const updateStatus = async (enrollmentId, newStatus) => {
    setBusyId(enrollmentId)
    setError(null)
    const { error } = await supabase
      .from('enrollments')
      .update({ status: newStatus })
      .eq('id', enrollmentId)

    if (error) {
      setError(error.message)
    } else {
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: newStatus } : e))
      )
    }
    setBusyId(null)
  }

  const filtered = enrollments.filter((e) => {
    const matchProgram = filterProgram === 'all' || e.program_id === filterProgram
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchProgram && matchStatus
  })

  const stats = {
    total:     enrollments.length,
    pending:   enrollments.filter((e) => e.status === 'pending').length,
    confirmed: enrollments.filter((e) => e.status === 'confirmed').length,
    waitlisted:enrollments.filter((e) => e.status === 'waitlisted').length,
  }

  if (!loading && role !== 'admin' && role !== 'staff') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage patient enrollments across all programs.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-900' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
            { label: 'Confirmed', value: stats.confirmed, color: 'text-green-600' },
            { label: 'Waitlisted', value: stats.waitlisted, color: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading enrollments...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No enrollments match the selected filters.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Program</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Enrolled</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{e.patients?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{e.patients?.phone || 'No phone'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{e.programs?.name}</p>
                      <p className="text-xs text-slate-400">{e.programs?.category}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(e.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {e.status !== 'confirmed' && (
                          <button
                            onClick={() => updateStatus(e.id, 'confirmed')}
                            disabled={busyId === e.id}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        )}
                        {e.status !== 'waitlisted' && (
                          <button
                            onClick={() => updateStatus(e.id, 'waitlisted')}
                            disabled={busyId === e.id}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Waitlist
                          </button>
                        )}
                        {e.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus(e.id, 'cancelled')}
                            disabled={busyId === e.id}
                            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
