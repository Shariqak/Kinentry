import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AdminNavBar } from '../components/AdminNavBar'
import { logAudit } from '../lib/auditLog'

const ELIGIBILITY_STYLES = {
  unverified: 'bg-slate-100 text-slate-500',
  pending:    'bg-amber-100 text-amber-700',
  eligible:   'bg-green-100 text-green-700',
  ineligible: 'bg-red-100 text-red-700',
}

const IDENTITY_STYLES = {
  unverified:    'bg-slate-100 text-slate-500',
  verified:      'bg-green-100 text-green-700',
  partial_match: 'bg-amber-100 text-amber-700',
  mismatch:      'bg-red-100 text-red-700',
}

const ROLE_STYLES = {
  patient: 'bg-slate-100 text-slate-600',
  staff:   'bg-blue-100 text-blue-700',
  admin:   'bg-purple-100 text-purple-700',
}

export default function AdminPatients() {
  const { user } = useAuth()
  const [role, setRole] = useState(null)
  const [patients, setPatients] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [eligibilityFilter, setEligibilityFilter] = useState('all')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [programs, setPrograms] = useState([])
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', duration_minutes: 30, program_id: '', physician_name: '', location: '' })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState(null)

  useEffect(() => {
    async function loadData() {
      const { data: roleData } = await supabase
        .from('patients')
        .select('role')
        .eq('id', user.id)
        .single()
      setRole(roleData?.role || 'patient')

      if (roleData?.role !== 'staff' && roleData?.role !== 'admin') {
        setLoading(false)
        return
      }

      const [patientsRes, enrollmentsRes, appointmentsRes, programsRes] = await Promise.all([
        supabase
          .from('patients')
          .select('id, full_name, date_of_birth, phone, insurance_provider, member_id, plan_type, eligibility_status, identity_verification_status, preferred_language, role, onboarding_complete')
          .order('full_name'),
        supabase
          .from('enrollments')
          .select('id, patient_id, status, enrolled_at, programs(name)')
          .order('enrolled_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('*, programs(name)')
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('programs')
          .select('id, name')
          .order('name'),
      ])

      if (appointmentsRes.data) setAppointments(appointmentsRes.data)
      if (programsRes.data) setPrograms(programsRes.data)

      if (patientsRes.error) setError(patientsRes.error.message)
      else setPatients(patientsRes.data)

      if (enrollmentsRes.data) setEnrollments(enrollmentsRes.data)
      setLoading(false)
    }
    loadData()
  }, [user.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      const matchesSearch =
        !q ||
        p.full_name?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.member_id?.toLowerCase().includes(q)
      const matchesRole = roleFilter === 'all' || p.role === roleFilter
      const matchesEligibility = eligibilityFilter === 'all' || (p.eligibility_status || 'unverified') === eligibilityFilter
      return matchesSearch && matchesRole && matchesEligibility
    })
  }, [patients, search, roleFilter, eligibilityFilter])

  const openPatient = (patient) => {
    setSelectedPatient(patient)
    logAudit({
      action: 'view',
      resourceType: 'patients',
      resourceId: patient.id,
      patientId: patient.id,
      description: `Staff viewed patient record for "${patient.full_name}" from Patients list`,
    })
  }

  if (!loading && role !== 'admin' && role !== 'staff') {
    return <Navigate to="/patient/dashboard" replace />
  }

  const patientEnrollments = selectedPatient
    ? enrollments.filter((e) => e.patient_id === selectedPatient.id)
    : []

  const patientAppointments = selectedPatient
    ? appointments.filter((a) => a.patient_id === selectedPatient.id)
    : []

  const scheduleAppointment = async () => {
    if (!scheduleForm.date || !scheduleForm.time) {
      setScheduleError('Date and time are required.')
      return
    }
    setScheduleSaving(true)
    setScheduleError(null)

    const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString()

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: selectedPatient.id,
        program_id: scheduleForm.program_id || null,
        scheduled_at: scheduledAt,
        duration_minutes: Number(scheduleForm.duration_minutes) || 30,
        physician_name: scheduleForm.physician_name.trim() || null,
        location: scheduleForm.location.trim() || null,
        created_by: user.id,
      })
      .select('*, programs(name)')
      .single()

    setScheduleSaving(false)

    if (error) {
      setScheduleError(error.message)
      return
    }

    setAppointments((prev) => [...prev, data])
    setShowScheduleForm(false)
    setScheduleForm({ date: '', time: '', duration_minutes: 30, program_id: '', physician_name: '', location: '' })

    logAudit({
      action: 'create',
      resourceType: 'appointments',
      resourceId: data.id,
      patientId: selectedPatient.id,
      description: `Staff scheduled appointment for "${selectedPatient.full_name}" on ${new Date(scheduledAt).toLocaleString()}`,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavBar />
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search and review patient records, insurance status, and identity verification.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or member ID..."
            className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All roles</option>
            <option value="patient">Patients only</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={eligibilityFilter}
            onChange={(e) => setEligibilityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All eligibility statuses</option>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending</option>
            <option value="eligible">Eligible</option>
            <option value="ineligible">Ineligible</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading patients...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No patients match your search.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Insurance</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Eligibility</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Identity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{p.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-slate-400">{p.onboarding_complete ? 'Onboarded' : 'Onboarding incomplete'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{p.phone || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{p.insurance_provider || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${ELIGIBILITY_STYLES[p.eligibility_status || 'unverified']}`}>
                        {p.eligibility_status || 'unverified'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${IDENTITY_STYLES[p.identity_verification_status || 'unverified']}`}>
                        {(p.identity_verification_status || 'unverified').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${ROLE_STYLES[p.role] || ROLE_STYLES.patient}`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openPatient(p)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-40">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{selectedPatient.full_name}</h2>
              <button onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Date of birth</p>
                  <p className="text-slate-800">{selectedPatient.date_of_birth || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
                  <p className="text-slate-800">{selectedPatient.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Preferred language</p>
                  <p className="text-slate-800">{selectedPatient.preferred_language || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
                  <p className="capitalize text-slate-800">{selectedPatient.role}</p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Insurance</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Provider:</span> {selectedPatient.insurance_provider || '—'}</p>
                  <p><span className="text-slate-500">Member ID:</span> {selectedPatient.member_id || '—'}</p>
                  <p><span className="text-slate-500">Plan type:</span> {selectedPatient.plan_type || '—'}</p>
                  <p>
                    <span className="text-slate-500">Eligibility:</span>{' '}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ELIGIBILITY_STYLES[selectedPatient.eligibility_status || 'unverified']}`}>
                      {selectedPatient.eligibility_status || 'unverified'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Identity verification</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${IDENTITY_STYLES[selectedPatient.identity_verification_status || 'unverified']}`}>
                  {(selectedPatient.identity_verification_status || 'unverified').replace('_', ' ')}
                </span>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Enrollments ({patientEnrollments.length})</p>
                {patientEnrollments.length === 0 ? (
                  <p className="text-sm text-slate-400">No enrollments on record.</p>
                ) : (
                  <div className="space-y-2">
                    {patientEnrollments.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <span className="text-slate-700">{e.programs?.name || 'Unknown program'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          e.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          e.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          e.status === 'waitlisted' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {e.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Appointments ({patientAppointments.length})</p>
                  <button
                    onClick={() => setShowScheduleForm((v) => !v)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {showScheduleForm ? 'Cancel' : '+ Schedule'}
                  </button>
                </div>

                {showScheduleForm && (
                  <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={scheduleForm.date}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      <input type="time" value={scheduleForm.time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                    </div>
                    <select value={scheduleForm.program_id}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, program_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="">No specific program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="Physician name" value={scheduleForm.physician_name}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, physician_name: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                    <input type="text" placeholder="Location (e.g. Room 204)" value={scheduleForm.location}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                    {scheduleError && <p className="text-xs text-red-600">{scheduleError}</p>}
                    <button onClick={scheduleAppointment} disabled={scheduleSaving}
                      className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {scheduleSaving ? 'Scheduling...' : 'Confirm Appointment'}
                    </button>
                  </div>
                )}

                {patientAppointments.length === 0 ? (
                  <p className="text-sm text-slate-400">No appointments scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {patientAppointments.map((a) => (
                      <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">{new Date(a.scheduled_at).toLocaleString()}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            a.status === 'completed' ? 'bg-slate-100 text-slate-500' :
                            a.status === 'cancelled' ? 'bg-red-100 text-red-500' :
                            a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {a.status.replace('_', ' ')}
                          </span>
                        </div>
                        {(a.physician_name || a.location) && (
                          <p className="mt-1 text-xs text-slate-400">
                            {a.physician_name}{a.physician_name && a.location ? ' · ' : ''}{a.location}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
