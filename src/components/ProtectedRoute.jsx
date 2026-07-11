import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

// Cache onboarding status so it doesnt re-query after completion
const onboardingCache = {}

export function ProtectedRoute({ children, requireOnboarding = true }) {
  const { session, loading } = useAuth()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkOnboarding() {
      if (!session) { setChecking(false); return }

      const userId = session.user.id

      // Use cached value if available
      if (onboardingCache[userId] === true) {
        setOnboardingComplete(true)
        setChecking(false)
        return
      }

      const { data } = await supabase
        .from("patients")
        .select("onboarding_complete, role")
        .eq("id", userId)
        .single()

      const complete = data?.onboarding_complete === true
      onboardingCache[userId] = complete
      setOnboardingComplete(complete)
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
