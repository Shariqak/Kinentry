import { useEffect, useState, useCallback } from 'react'
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

export default function Programs() {
  const { user } = useAuth()
  const [programs, setPrograms]       = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [busyId, setBusyId]           = useState(null)
  const [search, setSearch]           = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [progRes, enrRes] = await Promise.all([
      supabase.from('programs').select('*').order('start_date', { ascending: true }),
      supabase.from('enrollments').select('*').eq('patient_id', user.id),
    ])

    if (progRes.error) setError(progRes.error.message)
    else setPrograms(progRes.data)

    if (enrRes.error) setError((prev) => prev ?? enrRes.error.message)
    else setEnrollments(enrRes.data)

    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  const enrollmentFor = (programId) =>
    enrollments.find((e) => e.program_id === programId && e.status !== 'cancelled')

  const cancelledEnrollmentFor = (programId) =>
    enrollments.find((e) => e.program_id === programId && e.status === 'cancelled')

  const handleEnroll = async (programId) => {
    setBusyId(programId)
    setError(null)

    const existing = cancelledEnrollmentFor(programId)

    if (existing) {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'pending', enrolled_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) setError(error.message)
    } else {
      const { error } = await supabase
        .from('enrollments')
        .insert({ patient_id: user.id, program_id: programId, status: 'pending' })
      if (error) setError(error.message)
    }

    await loadData()
    setBusyId(null)
  }

  const handleCancel = async (enrollmentId) => {
    setBusyId(enrollmentId)
    setError(null)
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('id', enrollmentId)
    if (error) setError(error.message)
    else await loadData()
    setBusyId(null)
  }

  const filtered = programs
    .filter((p) => p.status !== 'draft')
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavBar />
      <div className="mx-auto max-w-5xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clinical Programs</h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse available programs and submit your enrollment request.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search by name or specialty"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        {loading ? (
          <p className="mt-8 text-slate-500">Loading programs...</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-slate-500">No programs found.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {filtered.map((program) => {
              const enrollment = enrollmentFor(program.id)
              const isBusy = busyId === program.id || busyId === enrollment?.id
              const catStyle = CATEGORY_STYLES[program.category] ?? 'bg-slate-100 text-slate-600'

              return (
                <div
                  key={program.id}
                  className="flex items-start justify-between rounded-xl bg-white p-5 shadow-sm"
                >
                  <div className="flex-1 pr-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-slate-900">{program.name}</h2>
                      <span className="text-xs font-mono text-slate-400">{program.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catStyle}`}>
                        {program.category}
                      </span>
                    </div>
                    {program.description && (
                      <p className="mt-1 text-sm text-slate-600">{program.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                      {program.location && <span>📍 {program.location}</span>}
                      {program.start_date && (
                        <span>
                          🗓 {new Date(program.start_date).toLocaleDateString()} -{' '}
                          {new Date(program.end_date).toLocaleDateString()}
                        </span>
                      )}
                      <span>👥 Capacity: {program.capacity}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {enrollment ? (
                      <>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[enrollment.status]}`}>
                          {enrollment.status}
                        </span>
                        <button
                          onClick={() => handleCancel(enrollment.id)}
                          disabled={isBusy}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {isBusy ? '...' : 'Cancel'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEnroll(program.id)}
                        disabled={isBusy || program.status !== 'open'}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isBusy ? 'Enrolling...' : program.status === 'open' ? 'Enroll' : 'Closed'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
