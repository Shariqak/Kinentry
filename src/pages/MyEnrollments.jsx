import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PatientNavBar } from '../components/PatientNavBar'

const STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-800',
  confirmed:  'bg-green-100 text-green-800',
  waitlisted: 'bg-blue-100 text-blue-800',
  cancelled:  'bg-slate-100 text-slate-500',
}

const CATEGORY_STYLES = {
  Cardiology:    'bg-red-50 text-red-700',
  Endocrinology: 'bg-orange-50 text-orange-700',
  Oncology:      'bg-purple-50 text-purple-700',
  Pulmonology:   'bg-sky-50 text-sky-700',
  Psychiatry:    'bg-teal-50 text-teal-700',
  Orthopaedics:  'bg-indigo-50 text-indigo-700',
}

export default function MyEnrollments() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function loadEnrollments() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, programs(*)')
      .eq('patient_id', user.id)
      .order('enrolled_at', { ascending: false })

    if (error) setError(error.message)
    else setEnrollments(data)
    setLoading(false)
  }

  useEffect(() => { loadEnrollments() }, [user.id])

  const handleCancel = async (enrollmentId) => {
    setBusyId(enrollmentId)
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('id', enrollmentId)
    if (error) setError(error.message)
    else await loadEnrollments()
    setBusyId(null)
  }

  const active = enrollments.filter((e) => e.status !== 'cancelled')
  const cancelled = enrollments.filter((e) => e.status === 'cancelled')

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavBar />
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">My Enrollments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the status of your program enrollments.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        {loading ? (
          <p className="mt-8 text-slate-500">Loading enrollments…</p>
        ) : enrollments.length === 0 ? (
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">You have not enrolled in any programs yet.</p>
            <a href="/patient/programs" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
              Browse programs
            </a>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Active ({active.length})
                </h2>
                <div className="grid gap-4">
                  {active.map((e) => {
                    const catStyle = CATEGORY_STYLES[e.programs.category] ?? 'bg-slate-100 text-slate-600'
                    return (
                      <div key={e.id} className="flex items-start justify-between rounded-xl bg-white p-5 shadow-sm">
                        <div className="flex-1 pr-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900">{e.programs.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catStyle}`}>
                              {e.programs.category}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                            {e.programs.location && <span>📍 {e.programs.location}</span>}
                            {e.programs.start_date && (
                              <span>
                                🗓 {new Date(e.programs.start_date).toLocaleDateString()} –{' '}
                                {new Date(e.programs.end_date).toLocaleDateString()}
                              </span>
                            )}
                            <span>Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}>
                            {e.status}
                          </span>
                          <button
                            onClick={() => handleCancel(e.id)}
                            disabled={busyId === e.id}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {busyId === e.id ? '…' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {cancelled.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Cancelled ({cancelled.length})
                </h2>
                <div className="grid gap-4">
                  {cancelled.map((e) => (
                    <div key={e.id} className="flex items-start justify-between rounded-xl bg-white p-5 shadow-sm opacity-60">
                      <div>
                        <h3 className="font-semibold text-slate-900">{e.programs.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Cancelled · Enrolled {new Date(e.enrolled_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full px-3 py-1 text-xs font-medium capitalize bg-slate-100 text-slate-500">
                        cancelled
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
