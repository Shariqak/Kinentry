import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { NavBar } from "../components/NavBar"
import { InsuranceCardScanner } from "../components/InsuranceCardScanner"
import { EligibilityChecker } from "../components/EligibilityChecker"
import { ConsentGate } from "../components/ConsentGate"
import { logAudit } from "../lib/auditLog"

const schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  insurance_provider: z.string().optional(),
  member_id: z.string().optional(),
  group_number: z.string().optional(),
  plan_type: z.string().optional(),
  policy_holder: z.string().optional(),
  preferred_language: z.string().optional(),
})

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "ur", label: "Urdu" },
  { code: "fr", label: "French" },
  { code: "zh", label: "Mandarin" },
]

const PLAN_TYPES = ["HMO", "PPO", "EPO", "POS", "Medicare", "Medicaid", "Other"]

const ELIGIBILITY_STYLES = {
  unverified: "bg-slate-100 text-slate-500",
  pending:    "bg-amber-100 text-amber-700",
  eligible:   "bg-green-100 text-green-700",
  ineligible: "bg-red-100 text-red-700",
}

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [eligibilityStatus, setEligibilityStatus] = useState("unverified")
  const [patientData, setPatientData] = useState(null)
  const [deletionRequest, setDeletionRequest] = useState(null)
  const [deletionReason, setDeletionReason] = useState("")
  const [deletionSubmitting, setDeletionSubmitting] = useState(false)
  const [deletionError, setDeletionError] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from("patients")
        .select("full_name, date_of_birth, phone, insurance_provider, member_id, group_number, plan_type, policy_holder, preferred_language, eligibility_status, eligibility_checked_at")
        .eq("id", user.id)
        .single()

      if (!error && data) {
        reset(data)
        setEligibilityStatus(data.eligibility_status || "unverified")
        setPatientData({ ...data, id: user.id })
        logAudit({
          action: "view",
          resourceType: "patients",
          resourceId: user.id,
          patientId: user.id,
          description: "Patient viewed their own profile",
        })
      }
      setLoading(false)
    }
    loadProfile()

    async function loadDeletionRequest() {
      const { data } = await supabase
        .from("deletion_requests")
        .select("id, status, requested_at, review_notes")
        .eq("patient_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      setDeletionRequest(data || null)
    }
    loadDeletionRequest()
  }, [user.id, reset])

  const submitDeletionRequest = async () => {
    setDeletionSubmitting(true)
    setDeletionError(null)

    const { data, error } = await supabase
      .from("deletion_requests")
      .insert({ patient_id: user.id, reason: deletionReason || null })
      .select("id, status, requested_at, review_notes")
      .single()

    setDeletionSubmitting(false)

    if (error) {
      setDeletionError("Couldn't submit your request. Please try again.")
      return
    }

    setDeletionRequest(data)
    setDeletionReason("")
    logAudit({
      action: "create",
      resourceType: "deletion_requests",
      resourceId: data.id,
      patientId: user.id,
      description: "Patient requested deletion of their data",
    })
  }

  const handleScanComplete = (scannedData) => {
    setValue("insurance_provider", scannedData.insurance_provider)
    setValue("member_id", scannedData.member_id)
    setValue("group_number", scannedData.group_number)
    setValue("plan_type", scannedData.plan_type)
    setValue("policy_holder", scannedData.policy_holder)
    setSaved(false)
  }

  const onSubmit = async (data) => {
    setServerError(null)
    setSaved(false)
    const { error } = await supabase
      .from("patients")
      .update(data)
      .eq("id", user.id)

    if (error) setServerError(error.message)
    else {
      setSaved(true)
      setPatientData({ ...patientData, ...data })
      logAudit({
        action: "update",
        resourceType: "patients",
        resourceId: user.id,
        patientId: user.id,
        description: "Patient updated their own profile",
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="mx-auto max-w-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
            <p className="mt-1 text-sm text-slate-500">Personal details and insurance information.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${ELIGIBILITY_STYLES[eligibilityStatus]}`}>
            {eligibilityStatus === "unverified" ? "Eligibility Unverified" :
             eligibilityStatus === "eligible" ? "Insurance Eligible" :
             eligibilityStatus === "ineligible" ? "Insurance Ineligible" : "Verification Pending"}
          </span>
        </div>

        {loading ? (
          <p className="mt-6 text-slate-500">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                  <input type="text" {...register("full_name")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date of birth</label>
                  <input type="date" {...register("date_of_birth")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {errors.date_of_birth && <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone number</label>
                  <input type="tel" {...register("phone")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Preferred language</label>
                  <select {...register("preferred_language")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input type="email" value={user?.email} disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400" />
                  <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Insurance Information</h2>
              </div>
              <div className="mb-4">
                <ConsentGate consentType="insurance_scan">
                  <InsuranceCardScanner onScanComplete={handleScanComplete} />
                </ConsentGate>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Insurance provider</label>
                  <input type="text" {...register("insurance_provider")} placeholder="e.g. Blue Cross Blue Shield"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Member ID</label>
                    <input type="text" {...register("member_id")} placeholder="e.g. XYZ123456789"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Group number</label>
                    <input type="text" {...register("group_number")} placeholder="e.g. GRP987654"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Plan type</label>
                    <select {...register("plan_type")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="">Select plan type</option>
                      {PLAN_TYPES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Policy holder name</label>
                    <input type="text" {...register("policy_holder")} placeholder="If different from patient"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            {saved && (
              <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                Profile saved successfully.
              </p>
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save profile"}
            </button>
          </form>
        )}

        {patientData && (
          <div className="mt-6">
            <EligibilityChecker
              patient={{ ...patientData, eligibility_status: eligibilityStatus }}
              onStatusUpdate={(status) => {
                setEligibilityStatus(status)
                setPatientData((prev) => ({ ...prev, eligibility_status: status }))
              }}
            />
          </div>
        )}

        <div className="mt-6 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">Data & Privacy</h2>
          <p className="mt-1 text-sm text-slate-500">
            You can request that your data be permanently deleted. A staff member reviews every
            request before anything is removed.
          </p>

          {deletionRequest && deletionRequest.status !== "denied" ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-700 capitalize">
                Request status: {deletionRequest.status.replace("_", " ")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Submitted {new Date(deletionRequest.requested_at).toLocaleDateString()}
              </p>
              {deletionRequest.review_notes && (
                <p className="mt-2 text-slate-600">{deletionRequest.review_notes}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {deletionRequest?.status === "denied" && deletionRequest.review_notes && (
                <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  Your previous request was denied: {deletionRequest.review_notes}
                </p>
              )}
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Optional — tell us why you're requesting deletion"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {deletionError && <p className="text-sm text-red-600">{deletionError}</p>}
              <button
                type="button"
                onClick={submitDeletionRequest}
                disabled={deletionSubmitting}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {deletionSubmitting ? "Submitting..." : "Request account deletion"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
