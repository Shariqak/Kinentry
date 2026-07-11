import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
})

export default function ResetPassword() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sends tokens as hash fragments — detect and set session
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) setServerError(error.message)
    else {
      await supabase.auth.signOut()
      navigate("/login")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Set new password</h1>
        <p className="mb-6 text-sm text-slate-500">Choose a strong password you will remember.</p>

        {!ready ? (
          <div className="rounded-lg bg-amber-50 p-4 text-center">
            <p className="text-sm text-amber-700">Verifying your reset link...</p>
            <p className="mt-2 text-xs text-amber-600">If this takes too long, request a new reset link.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
              <input type="password" {...register("password")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
              <input type="password" {...register("confirm")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              {errors.confirm && <p className="mt-1 text-sm text-red-600">{errors.confirm.message}</p>}
            </div>
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
