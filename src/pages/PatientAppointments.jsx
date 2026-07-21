import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PatientNavBar } from '../components/PatientNavBar'

const STATUS_STYLES = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-500',
  no_show:   'bg-amber-100 text-amber-700',
}

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export default function PatientAppointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function loadAppointments() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('appointments')
      .select('*, programs(name, category)')
      .eq('patient_id', user.id)
      .order('scheduled_at', { ascending: true })

    if (error) setError(error.message)
    else setAppointments(data)
    setLoading(false)
  }

  useEffect(() => {
    loadAppointments()
  }, [user.id])

  const cancelAppointment = async (appt) => {
    if (!window.confirm(`Cancel your appointment on ${new Date(appt.scheduled_at).toLocaleString()}?`)) return
    setBusyId(appt.id)
    setError(null)

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: 'Cancelled by patient' })
      .eq('id', appt.id)

    setBusyId(null)

    if (error) {
      setError(error.message)
      return
    }

    setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, status: 'cancelled' } : a)))
  }

  const now = new Date()
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= now && a.status !== 'cancelled' && a.status !== 'completed')
  const past = appointments.filter((a) => new Date(a.scheduled_at) < now || a.status === 'cancelled' || a.status === 'completed')

  const AppointmentCard = ({ appt, canCancel }) => (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {new Date(appt.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-sm text-slate-500">
            {new Date(appt.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            {' · '}{appt.duration_minutes} min
          </p>
          {appt.programs?.name && <p className="mt-1 text-sm text-slate-600">{appt.programs.name}</p>}
          {appt.physician_name && <p className="text-sm text-slate-500">with {appt.physician_name}</p>}
          {appt.location && <p className="text-sm text-slate-400">{appt.location}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[appt.status]}`}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>
      {canCancel && (
        <button
          onClick={() => cancelAppointment(appt)}
          disabled={busyId === appt.id}
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          {busyId === appt.id ? 'Cancelling...' : 'Cancel appointment'}
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavBar />
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
        <p className="mt-1 text-sm text-slate-500">Your upcoming and past visits.</p>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="mt-6 text-slate-500">Loading appointments...</p>
        ) : (
          <>
            <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-slate-500">No upcoming appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((appt) => (
                  <AppointmentCard key={appt.id} appt={appt} canCancel />
                ))}
              </div>
            )}

            <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Past</h2>
            {past.length === 0 ? (
              <p className="text-slate-500">No past appointments yet.</p>
            ) : (
              <div className="space-y-3">
                {past.map((appt) => (
                  <AppointmentCard key={appt.id} appt={appt} canCancel={false} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
