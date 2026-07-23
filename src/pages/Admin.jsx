import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AdminNavBar } from '../components/AdminNavBar'
import { Navigate } from 'react-router-dom'
import { logAudit } from '../lib/auditLog'

const DELETION_STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-800',
  in_review:  'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  denied:     'bg-slate-100 text-slate-500',
}

const INSURANCE_STATUS_STYLES = {
  pending:          'bg-slate-100 text-slate-600',
  under_review:     'bg-blue-100 text-blue-700',
  needs_correction: 'bg-amber-100 text-amber-700',
  verified:         'bg-green-100 text-green-700',
  ineligible:       'bg-red-100 text-red-700',
}

const INSURANCE_STATUS_LABELS = {
  pending: 'Not Submitted',
  under_review: 'Under Review',
  needs_correction: 'Needs Correction',
  verified: 'Verified',
  ineligible: 'Ineligible',
}

const STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-800',
  confirmed:  'bg-green-100 text-green-800',
  waitlisted: 'bg-blue-100 text-blue-800',
  cancelled:  'bg-slate-100 text-slate-500',
}

const PROGRAM_STATUS_STYLES = {
  draft:  'bg-slate-100 text-slate-500',
  open:   'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
}

const EMPTY_PROGRAM_FORM = {
  name: '', code: '', description: '', category: '', capacity: '',
  location: '', start_date: '', end_date: '', status: 'draft',
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
  const [deletionRequests, setDeletionRequests] = useState([])
  const [insuranceVerifications, setInsuranceVerifications] = useState([])
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false)
  const [deletionBusyId, setDeletionBusyId] = useState(null)
  const [deletionNotes, setDeletionNotes] = useState({})
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState(null)
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM_FORM)
  const [programSaving, setProgramSaving] = useState(false)
  const [programError, setProgramError] = useState(null)
  const [programBusyId, setProgramBusyId] = useState(null)
  const [schedulingEnrollment, setSchedulingEnrollment] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ scheduled_at: '', physician_name: '', location: '' })
  const [schedulingBusy, setSchedulingBusy] = useState(false)
  const [schedulingError, setSchedulingError] = useState(null)

  useEffect(() => {
    async function loadData() {
      const { data: patient } = await supabase
        .from('patients')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(patient?.role)

      const [enrRes, progRes, delRes, insRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('*, patients(full_name, phone), programs(name, category, capacity)')
          .order('enrolled_at', { ascending: false }),
        supabase.from('programs').select('*').order('name'),
        supabase
          .from('deletion_requests')
          .select('*, patients(full_name, phone)')
          .order('requested_at', { ascending: false }),
        supabase
          .from('insurance_verifications')
          .select('patient_id, status, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (enrRes.data) setEnrollments(enrRes.data)
      if (progRes.data) setPrograms(progRes.data)
      if (delRes.data) setDeletionRequests(delRes.data)
      if (insRes.data) setInsuranceVerifications(insRes.data)
      setLoading(false)
    }
    loadData()
  }, [user.id])

  const updateStatus = async (enrollmentId, newStatus) => {
    setBusyId(enrollmentId)
    setError(null)
    const { data, error } = await supabase
      .from('enrollments')
      .update({ status: newStatus })
      .eq('id', enrollmentId)
      .select()
      .maybeSingle()

    if (error) {
      setError(error.message)
    } else if (!data) {
      // .update() doesn't error when RLS silently matches 0 rows — checking
      // the returned row is the only way to catch that here.
      setError('Update did not apply — you may not have permission to change this enrollment.')
    } else {
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: newStatus } : e))
      )
      logAudit({
        action: 'update',
        resourceType: 'enrollments',
        resourceId: enrollmentId,
        description: `Staff changed enrollment status to ${newStatus}`,
      })
    }
    setBusyId(null)
  }

  const openScheduleModal = (enrollment) => {
    setSchedulingEnrollment(enrollment)
    setScheduleForm({
      scheduled_at: '',
      physician_name: '',
      location: enrollment.programs?.location || '',
    })
    setSchedulingError(null)
    setOverrideAcknowledged(false)
  }

  // insuranceVerifications is ordered created_at desc from the fetch, so the
  // first match per patient is their latest/current case.
  const getLatestInsuranceStatus = (patientId) =>
    insuranceVerifications.find((v) => v.patient_id === patientId)?.status || null

  const closeScheduleModal = () => {
    setSchedulingEnrollment(null)
    setScheduleForm({ scheduled_at: '', physician_name: '', location: '' })
    setSchedulingError(null)
  }

  const confirmAndSchedule = async () => {
    if (!scheduleForm.scheduled_at) {
      setSchedulingError('Please pick a date and time for the appointment.')
      return
    }

    setSchedulingBusy(true)
    setSchedulingError(null)
    const enrollment = schedulingEnrollment

    const { data: enrollData, error: enrollError } = await supabase
      .from('enrollments')
      .update({ status: 'confirmed' })
      .eq('id', enrollment.id)
      .select()
      .maybeSingle()

    if (enrollError) {
      setSchedulingBusy(false)
      setSchedulingError(enrollError.message)
      return
    }
    if (!enrollData) {
      setSchedulingBusy(false)
      setSchedulingError('Could not confirm this enrollment — you may not have permission to change it.')
      return
    }

    const { error: apptError } = await supabase.from('appointments').insert({
      patient_id: enrollment.patient_id,
      program_id: enrollment.program_id,
      scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
      physician_name: scheduleForm.physician_name || null,
      location: scheduleForm.location || null,
      created_by: user.id,
    })

    setSchedulingBusy(false)

    if (apptError) {
      setSchedulingError(`Enrollment confirmed, but scheduling the appointment failed: ${apptError.message}`)
      return
    }

    setEnrollments((prev) =>
      prev.map((e) => (e.id === enrollment.id ? { ...e, status: 'confirmed' } : e))
    )
    logAudit({
      action: 'update',
      resourceType: 'enrollments',
      resourceId: enrollment.id,
      description: 'Staff confirmed enrollment and scheduled an appointment',
    })
    logAudit({
      action: 'create',
      resourceType: 'appointments',
      patientId: enrollment.patient_id,
      description: `Staff scheduled an appointment for "${enrollment.patients?.full_name || 'patient'}"`,
    })
    closeScheduleModal()
  }

  const updateDeletionRequest = async (request, newStatus) => {
    setDeletionBusyId(request.id)
    setError(null)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('deletion_requests')
      .update({
        status: newStatus,
        reviewed_by: currentUser?.id ?? null,
        reviewed_at: new Date().toISOString(),
        review_notes: deletionNotes[request.id] || null,
      })
      .eq('id', request.id)

    if (error) {
      setError(error.message)
    } else {
      setDeletionRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: newStatus } : r))
      )
      logAudit({
        action: 'update',
        resourceType: 'deletion_requests',
        resourceId: request.id,
        patientId: request.patient_id,
        description: `Staff set deletion request to ${newStatus}`,
      })
    }
    setDeletionBusyId(null)
  }

  const openCreateProgram = () => {
    setEditingProgramId(null)
    setProgramForm(EMPTY_PROGRAM_FORM)
    setProgramError(null)
    setShowProgramForm(true)
  }

  const openEditProgram = (program) => {
    setEditingProgramId(program.id)
    setProgramForm({
      name: program.name || '',
      code: program.code || '',
      description: program.description || '',
      category: program.category || '',
      capacity: program.capacity ?? '',
      location: program.location || '',
      start_date: program.start_date || '',
      end_date: program.end_date || '',
      status: program.status || 'draft',
    })
    setProgramError(null)
    setShowProgramForm(true)
  }

  const closeProgramForm = () => {
    setShowProgramForm(false)
    setEditingProgramId(null)
    setProgramForm(EMPTY_PROGRAM_FORM)
    setProgramError(null)
  }

  const saveProgram = async () => {
    if (!programForm.name.trim()) {
      setProgramError('Program name is required.')
      return
    }

    setProgramSaving(true)
    setProgramError(null)

    const payload = {
      name: programForm.name.trim(),
      code: programForm.code.trim() || null,
      description: programForm.description.trim() || null,
      category: programForm.category.trim() || null,
      capacity: programForm.capacity === '' ? null : Number(programForm.capacity),
      location: programForm.location.trim() || null,
      start_date: programForm.start_date || null,
      end_date: programForm.end_date || null,
      status: programForm.status,
    }

    if (editingProgramId) {
      const { data, error } = await supabase
        .from('programs')
        .update(payload)
        .eq('id', editingProgramId)
        .select()
        .single()

      setProgramSaving(false)

      if (error) {
        setProgramError(error.message)
        return
      }

      setPrograms((prev) => prev.map((p) => (p.id === editingProgramId ? data : p)))
      logAudit({
        action: 'update',
        resourceType: 'programs',
        resourceId: editingProgramId,
        description: `Staff updated program "${data.name}"`,
      })
    } else {
      const { data, error } = await supabase
        .from('programs')
        .insert(payload)
        .select()
        .single()

      setProgramSaving(false)

      if (error) {
        setProgramError(error.message)
        return
      }

      setPrograms((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      logAudit({
        action: 'create',
        resourceType: 'programs',
        resourceId: data.id,
        description: `Staff created program "${data.name}"`,
      })
    }

    closeProgramForm()
  }

  const toggleProgramStatus = async (program, newStatus) => {
    setProgramBusyId(program.id)
    setError(null)

    const { error } = await supabase
      .from('programs')
      .update({ status: newStatus })
      .eq('id', program.id)

    if (error) {
      setError(error.message)
    } else {
      setPrograms((prev) => prev.map((p) => (p.id === program.id ? { ...p, status: newStatus } : p)))
      logAudit({
        action: 'update',
        resourceType: 'programs',
        resourceId: program.id,
        description: `Staff set program "${program.name}" to ${newStatus}`,
      })
    }
    setProgramBusyId(null)
  }

  const deleteProgram = async (program) => {
    const enrolledCount = enrollments.filter((e) => e.program_id === program.id).length
    const confirmMsg = enrolledCount > 0
      ? `"${program.name}" has ${enrolledCount} enrollment(s) on record. Deleting it may fail or orphan those records — consider setting it to "closed" instead. Delete anyway?`
      : `Delete "${program.name}"? This cannot be undone.`

    if (!window.confirm(confirmMsg)) return

    setProgramBusyId(program.id)
    setError(null)

    const { error } = await supabase.from('programs').delete().eq('id', program.id)

    if (error) {
      setError(`Couldn't delete "${program.name}": ${error.message}`)
    } else {
      setPrograms((prev) => prev.filter((p) => p.id !== program.id))
      logAudit({
        action: 'delete',
        resourceType: 'programs',
        resourceId: program.id,
        description: `Staff deleted program "${program.name}"`,
      })
    }
    setProgramBusyId(null)
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
    return <Navigate to="/patient/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavBar />
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

        <div className="mb-4 mt-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Programs</h2>
            <p className="mt-1 text-sm text-slate-500">Create and manage clinical programs patients can enroll in.</p>
          </div>
          <button
            onClick={openCreateProgram}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add Program
          </button>
        </div>

        {programs.length === 0 ? (
          <p className="text-slate-500">No programs yet — click "Add Program" to create one.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Program</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Category</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Capacity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Dates</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p) => {
                  const enrolledCount = enrollments.filter(
                    (e) => e.program_id === p.id && e.status !== 'cancelled'
                  ).length
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.code}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{p.category || '—'}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {enrolledCount}{p.capacity != null ? ` / ${p.capacity}` : ''}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs">
                        {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'}
                        {p.end_date ? ` – ${new Date(p.end_date).toLocaleDateString()}` : ''}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${PROGRAM_STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-500'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => openEditProgram(p)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          {p.status !== 'open' && (
                            <button
                              onClick={() => toggleProgramStatus(p, 'open')}
                              disabled={programBusyId === p.id}
                              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Open
                            </button>
                          )}
                          {p.status !== 'closed' && (
                            <button
                              onClick={() => toggleProgramStatus(p, 'closed')}
                              disabled={programBusyId === p.id}
                              className="rounded-lg bg-slate-500 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                            >
                              Close
                            </button>
                          )}
                          <button
                            onClick={() => deleteProgram(p)}
                            disabled={programBusyId === p.id}
                            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {showProgramForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingProgramId ? 'Edit Program' : 'Add Program'}
                </h2>
                <button onClick={closeProgramForm} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Program name *</label>
                  <input type="text" value={programForm.name}
                    onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
                    <input type="text" value={programForm.code}
                      onChange={(e) => setProgramForm({ ...programForm, code: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                    <input type="text" value={programForm.category} placeholder="e.g. Cardiology"
                      onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea value={programForm.description} rows={2}
                    onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Capacity</label>
                    <input type="number" min="0" value={programForm.capacity}
                      onChange={(e) => setProgramForm({ ...programForm, capacity: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                    <input type="text" value={programForm.location}
                      onChange={(e) => setProgramForm({ ...programForm, location: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
                    <input type="date" value={programForm.start_date}
                      onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
                    <input type="date" value={programForm.end_date}
                      onChange={(e) => setProgramForm({ ...programForm, end_date: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select value={programForm.status}
                    onChange={(e) => setProgramForm({ ...programForm, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="draft">Draft (hidden from patients)</option>
                    <option value="open">Open (accepting enrollments)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {programError && <p className="text-sm text-red-600">{programError}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={closeProgramForm}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={saveProgram} disabled={programSaving}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {programSaving ? 'Saving...' : editingProgramId ? 'Save Changes' : 'Create Program'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 mt-10">
          <h2 className="text-xl font-bold text-slate-900">Enrollments</h2>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Insurance</th>
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
                      {(() => {
                        const insStatus = getLatestInsuranceStatus(e.patient_id)
                        if (!insStatus) {
                          return <span className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-400">No case</span>
                        }
                        return (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${INSURANCE_STATUS_STYLES[insStatus]}`}>
                            {INSURANCE_STATUS_LABELS[insStatus]}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {e.status !== 'confirmed' && (
                          <button
                            onClick={() => openScheduleModal(e)}
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

        <div className="mt-10 mb-4">
          <h2 className="text-xl font-bold text-slate-900">Data Deletion Requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review and action patient requests to permanently delete their data.
          </p>
        </div>

        {deletionRequests.length === 0 ? (
          <p className="text-slate-500">No deletion requests.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Requested</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deletionRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{r.patients?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{r.patients?.phone || 'No phone'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 max-w-xs">{r.reason || '—'}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(r.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${DELETION_STATUS_STYLES[r.status]}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {r.status === 'completed' || r.status === 'denied' ? (
                        <span className="text-xs text-slate-400">No action needed</span>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Review notes (optional)"
                            value={deletionNotes[r.id] || ''}
                            onChange={(e) =>
                              setDeletionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <div className="flex gap-2 flex-wrap">
                            {r.status !== 'in_review' && (
                              <button
                                onClick={() => updateDeletionRequest(r, 'in_review')}
                                disabled={deletionBusyId === r.id}
                                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Mark In Review
                              </button>
                            )}
                            <button
                              onClick={() => updateDeletionRequest(r, 'completed')}
                              disabled={deletionBusyId === r.id}
                              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Mark Completed
                            </button>
                            <button
                              onClick={() => updateDeletionRequest(r, 'denied')}
                              disabled={deletionBusyId === r.id}
                              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {schedulingEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Confirm & Schedule</h2>
                <p className="text-sm text-slate-500">
                  {schedulingEnrollment.patients?.full_name} — {schedulingEnrollment.programs?.name}
                </p>
              </div>
              <button onClick={closeScheduleModal} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Confirming this enrollment schedules their first appointment — the patient will see it under "Appointments."
              </p>

              {(() => {
                const insStatus = getLatestInsuranceStatus(schedulingEnrollment.patient_id)
                if (insStatus === 'verified') return null
                return (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">
                      ⚠ Insurance is {insStatus ? INSURANCE_STATUS_LABELS[insStatus].toLowerCase() : 'not yet on file'} for this patient.
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Confirming before insurance is verified risks a denied claim. Check the Intake Queue before proceeding if unsure.
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-xs text-amber-800">
                      <input
                        type="checkbox"
                        checked={overrideAcknowledged}
                        onChange={(e) => setOverrideAcknowledged(e.target.checked)}
                      />
                      I understand insurance isn't verified and want to confirm anyway
                    </label>
                  </div>
                )
              })()}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date & time *</label>
                <input type="datetime-local" value={scheduleForm.scheduled_at}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Physician</label>
                <input type="text" value={scheduleForm.physician_name} placeholder="e.g. Dr. Lee"
                  onChange={(e) => setScheduleForm({ ...scheduleForm, physician_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                <input type="text" value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>

              {schedulingError && <p className="text-sm text-red-600">{schedulingError}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={closeScheduleModal}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={confirmAndSchedule}
                  disabled={
                    schedulingBusy ||
                    (getLatestInsuranceStatus(schedulingEnrollment.patient_id) !== 'verified' && !overrideAcknowledged)
                  }
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {schedulingBusy ? 'Saving...' : 'Confirm & Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
