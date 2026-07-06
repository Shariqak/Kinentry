import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar } from '../components/NavBar'

const schema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(6, 'Enter a valid phone number'),
})

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from('patients')
        .select('full_name, date_of_birth, phone')
        .eq('id', user.id)
        .single()

      if (!error && data) reset(data)
      setLoading(false)
    }
    loadProfile()
  }, [user.id, reset])

  const onSubmit = async (data) => {
    setServerError(null)
    setSaved(false)
    const { error } = await supabase
      .from('patients')
      .update(data)
      .eq('id', user.id)

    if (error) setServerError(error.message)
    else setSaved(true)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Keep your details up to date.</p>

        {loading ? (
          <p className="mt-6 text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                type="text"
                {...register('full_name')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date of birth</label>
              <input
                type="date"
                {...register('date_of_birth')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.date_of_birth && <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone number</label>
              <input
                type="tel"
                {...register('phone')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
            </div>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            {saved && <p className="text-sm text-green-600">Profile saved successfully.</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
