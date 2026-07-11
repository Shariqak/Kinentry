import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export function ProtectedRoute({ children, requireOnboarding = true }) {
  const { session, loading } = useAuth()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkOnboarding() {
      if (!session) { setChecking(false); return }
      const { data } = await supabase
        .from("patients")
        .select("onboarding_complete, role")
        .eq("id", session.user.id)
        .single()
      setOnboardingComplete(data?.onboarding_complete ?? false)
      setChecking(false)
    }
    checkOnboarding()
  }, [session])

  if (loading || checking) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (requireOnboarding && onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
