import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AdminNavBar } from '../components/AdminNavBar'
import { logAudit } from '../lib/auditLog'
import { formatAge, isAtRisk, UNRESOLVED_STATUSES as UNRESOLVED } from '../lib/intakeQueueHelpers'

const STATUS_STYLES = {
  pending:          'bg-slate-100 text-slate-600',
  under_review:     'bg-blue-100 text-blue-700',
  needs_correction: 'bg-amber-100 text-amber-700',
  verified:         'bg-green-100 text-green-700',
  ineligible:       'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  pending: 'Not Submitted',
  under_review: 'Under Review',
  needs_correction: 'Needs Correction',
  verified: 'Verified',
  ineligible: 'Ineligible',
}

export default function AdminIntakeQueue() {
  const { user } = useAuth()
  const [role, setRole] = useState(null)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('unresolved')
  const [search, setSearch] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [flashIds, setFlashIds] = useState(new Set())
  const flashTimers = useRef({})

  useEffect(() => {
    async function loadData() {
      const { data: roleData } = await supabase
        .from('patients').select('role').eq('id', user.id).single()
      setRole(roleData?.role || 'patient')

      if (roleData?.role !== 'staff' && roleData?.role !== 'admin') {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('insurance_verifications')
        .select('*, patients(full_name, phone)')
        .order('created_at', { ascending: true })

      if (error) setError(error.message)
      else setCases(data)
      setLoading(false)
    }
    loadData()
  }, [user.id])

  // Realtime: push new/updated cases into the queue live, instead of staff
  // needing to refresh. Falls back gracefully — if the subscription never
  // connects, the initial fetch above still shows current data.
  useEffect(() => {
    const channel = supabase
      .channel('intake-queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance_verifications' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setCases((prev) => {
              const exists = prev.some((c) => c.id === payload.new.id)
              if (exists) {
                // UPDATE: safe to merge directly — payload.new has no `patients`
                // key, so this can't wipe out the patients{} data already in state.
                return prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
              }
              // New case: postgres_changes payloads never include joined/embedded
              // relations, so append a placeholder now for instant visibility,
              // then fetch the real patient name right after (below).
              return [...prev, { ...payload.new, patients: null }]
            })
            flashRow(payload.new.id)

            if (payload.eventType === 'INSERT') {
              supabase
                .from('patients')
                .select('full_name, phone')
                .eq('id', payload.new.patient_id)
                .single()
                .then(({ data }) => {
                  if (!data) return
                  setCases((prev) =>
                    prev.map((c) => (c.id === payload.new.id ? { ...c, patients: data } : c))
                  )
                })
            }
          }
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const flashRow = (id) => {
    setFlashIds((prev) => new Set(prev).add(id))
    clearTimeout(flashTimers.current[id])
    flashTimers.current[id] = setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2500)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cases
      .filter((c) => {
        if (statusFilter === 'unresolved') return UNRESOLVED.includes(c.status)
        if (statusFilter === 'all') return true
        return c.status === statusFilter
      })
      .filter((c) => !q || c.patients?.full_name?.toLowerCase().includes(q) || c.payer_name?.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }, [cases, statusFilter, search])

  const openCase = (c) => {
    setSelectedCase(c)
    setReasonDraft('')
    logAudit({
      action: 'view',
      resourceType: 'insurance_verifications',
      resourceId: c.id,
      patientId: c.patient_id,
      description: `Staff opened insurance verification case for "${c.patients?.full_name || 'patient'}"`,
    })
  }

  const updateStatus = async (newStatus) => {
    if (!selectedCase) return
    setActionBusy(true)
    setError(null)

    const { data, error } = await supabase
      .from('insurance_verifications')
      .update({ status: newStatus, reason: reasonDraft || null })
      .eq('id', selectedCase.id)
      .select('*, patients(full_name, phone)')
      .single()

    setActionBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    setCases((prev) => prev.map((c) => (c.id === data.id ? data : c)))
    setSelectedCase(data)
    setReasonDraft('')

    logAudit({
      action: 'update',
      resourceType: 'insurance_verifications',
      resourceId: data.id,
      patientId: data.patient_id,
      description: `Staff set insurance verification to "${newStatus}"${reasonDraft ? `: ${reasonDraft}` : ''}`,
    })
  }

  if (!loading && role !== 'admin' && role !== 'staff') {
    return <Navigate to="/patient/dashboard" replace />
  }

  const atRiskCount = cases.filter(isAtRisk).length

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavBar />
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Intake Queue</h1>
            <p className="mt-1 text-sm text-slate-500">
              Insurance verification cases awaiting staff review.
            </p>
          </div>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${isLive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            {isLive ? 'Live' : 'Connecting...'}
          </span>
        </div>

        {atRiskCount > 0 && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            <strong>{atRiskCount}</strong> case{atRiskCount > 1 ? 's' : ''} open more than 3 days — revenue risk, review soon.
          </div>
        )}

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient or payer..."
            className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="unresolved">Unresolved (default)</option>
            <option value="all">All statuses</option>
            <option value="pending">Not Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="needs_correction">Needs Correction</option>
            <option value="verified">Verified</option>
            <option value="ineligible">Ineligible</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading queue...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No cases match this view.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Payer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Age</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 transition-colors ${flashIds.has(c.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{c.patients?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{c.patients?.phone || 'No phone'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{c.payer_name || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-xs ${isAtRisk(c) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      {formatAge(c.created_at)}{isAtRisk(c) ? ' ⚠' : ''}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openCase(c)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCase && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-40">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedCase.patients?.full_name || 'Unknown patient'}</h2>
                <span className={`inline-block mt-1 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[selectedCase.status]}`}>
                  {STATUS_LABELS[selectedCase.status]}
                </span>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-1">
                <p><span className="text-slate-500">Payer:</span> {selectedCase.payer_name || '—'}</p>
                <p><span className="text-slate-500">Member ID:</span> {selectedCase.member_id || '—'}</p>
                <p><span className="text-slate-500">Group:</span> {selectedCase.group_number || '—'}</p>
                <p><span className="text-slate-500">Plan type:</span> {selectedCase.plan_type || '—'}</p>
                <p><span className="text-slate-500">Opened:</span> {new Date(selectedCase.created_at).toLocaleString()} ({formatAge(selectedCase.created_at)} ago)</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Note / reason for next status change</label>
                <textarea
                  value={reasonDraft}
                  onChange={(e) => setReasonDraft(e.target.value)}
                  rows={2}
                  placeholder="e.g. Confirmed active coverage via payer portal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectedCase.status === 'pending' && (
                  <button onClick={() => updateStatus('under_review')} disabled={actionBusy}
                    className="col-span-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    Start Review
                  </button>
                )}
                {(selectedCase.status === 'under_review' || selectedCase.status === 'needs_correction') && (
                  <>
                    <button onClick={() => updateStatus('verified')} disabled={actionBusy}
                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      Mark Verified
                    </button>
                    <button onClick={() => updateStatus('needs_correction')} disabled={actionBusy}
                      className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                      Needs Correction
                    </button>
                    <button onClick={() => updateStatus('ineligible')} disabled={actionBusy}
                      className="col-span-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                      Mark Ineligible
                    </button>
                  </>
                )}
                {(selectedCase.status === 'verified' || selectedCase.status === 'ineligible') && (
                  <p className="col-span-2 text-center text-xs text-slate-400">This case is resolved.</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">History</p>
                <div className="space-y-2">
                  {(selectedCase.status_history || []).slice().reverse().map((h, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[h.status]}`}>
                          {STATUS_LABELS[h.status]}
                        </span>
                        <span className="text-slate-400">{new Date(h.changed_at).toLocaleString()}</span>
                      </div>
                      {h.reason && <p className="mt-1 text-slate-600">{h.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
