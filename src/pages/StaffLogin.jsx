import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function StaffLogin() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [notice, setNotice] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setServerError(null)
    setNotice(null)

    const { data: authData, error } = await signIn(data.email, data.password)
    if (error) {
      setServerError(error.message)
      return
    }

    const userId = authData?.user?.id
    const { data: patientRow } = await supabase
      .from('patients')
      .select('role')
      .eq('id', userId)
      .single()

    const role = patientRow?.role || 'patient'

    if (role === 'staff' || role === 'admin') {
      navigate('/admin/dashboard')
    } else {
      // Not an error — just not the door this account uses. Redirect them
      // to where they actually belong instead of showing a scary message.
      navigate('/patient/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            STAFF & CLINIC ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Kinentry Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your staff account.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          {notice && <p className="text-sm text-blue-600">{notice}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in to Admin'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/forgot-password" className="font-medium text-slate-500 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">
          Patient?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Go to patient login
          </Link>
        </p>
      </div>
    </div>
  )
}
