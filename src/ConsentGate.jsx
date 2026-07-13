import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { logAudit } from "../lib/auditLog"

const CONSENT_VERSION = "1.0"

const CONSENT_COPY = {
  insurance_scan: {
    title: "Consent to scan insurance card",
    body: "By continuing, you agree to let this clinic capture and process your insurance card details to auto-fill your profile and check eligibility. The card image is discarded immediately after the relevant text is extracted — it is never stored.",
  },
  id_scan: {
    title: "Consent to scan government ID",
    body: "By continuing, you agree to let this clinic capture and process your ID details to verify your identity. The ID image is discarded immediately after the relevant text is extracted — it is never stored.",
  },
}

/**
 * Wraps any PHI-capturing UI (card scanners, ID scanners, etc.) and blocks
 * rendering it until the patient has an active, non-revoked consent_records
 * row for the given consentType. Renders nothing while checking to avoid a
 * flash of the gated content.
 */
export function ConsentGate({ consentType, children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState("checking") // checking | needed | granted
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function checkConsent() {
      const { data } = await supabase
        .from("consent_records")
        .select("id")
        .eq("patient_id", user.id)
        .eq("consent_type", consentType)
        .eq("granted", true)
        .is("revoked_at", null)
        .order("granted_at", { ascending: false })
        .limit(1)

      if (!active) return
      setStatus(data && data.length > 0 ? "granted" : "needed")
    }
    checkConsent()

    return () => {
      active = false
    }
  }, [user.id, consentType])

  const grantConsent = async () => {
    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from("consent_records").insert({
      patient_id: user.id,
      consent_type: consentType,
      granted: true,
      version: CONSENT_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })

    setSubmitting(false)

    if (insertError) {
      setError("Couldn't save your consent. Please try again.")
      return
    }

    logAudit({
      action: "create",
      resourceType: "consent_records",
      patientId: user.id,
      description: `Patient granted consent for ${consentType}`,
    })
    setStatus("granted")
  }

  if (status === "checking") return null
  if (status === "granted") return children

  const copy = CONSENT_COPY[consentType] || {
    title: "Consent required",
    body: "By continuing, you agree to let this clinic capture and process this document.",
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">{copy.title}</p>
      <p className="mt-1 text-sm text-amber-800">{copy.body}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={grantConsent}
        disabled={submitting}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {submitting ? "Saving consent..." : "I consent — continue"}
      </button>
    </div>
  )
}
