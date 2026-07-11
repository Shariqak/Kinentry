import { useState } from "react"
import { supabase } from "../lib/supabase"
import { aiPreScreen, simulateEligibilityCheck } from "../lib/eligibility"

const STATUS_STYLES = {
  unverified: "bg-slate-100 text-slate-500",
  pending:    "bg-amber-100 text-amber-700",
  eligible:   "bg-green-100 text-green-700",
  ineligible: "bg-red-100 text-red-700",
}

export function EligibilityChecker({ patient, onStatusUpdate }) {
  const [stage, setStage] = useState("idle")
  const [preScreenResult, setPreScreenResult] = useState(null)
  const [eligibilityResult, setEligibilityResult] = useState(null)
  const [error, setError] = useState(null)

  const hasInsurance = patient?.insurance_provider && patient?.member_id

  const handleVerify = async () => {
    setError(null)
    setPreScreenResult(null)
    setEligibilityResult(null)

    // Stage 1: AI pre-screening
    setStage("prescreening")
    await new Promise((r) => setTimeout(r, 800))
    const preScreen = aiPreScreen(patient)
    setPreScreenResult(preScreen)

    if (!preScreen.canProceed) {
      setStage("failed")
      return
    }

    // Stage 2: Eligibility verification
    setStage("verifying")
    const result = await simulateEligibilityCheck(patient)
    setEligibilityResult(result)

    // Stage 3: Save result to database
    setStage("saving")
    const { error: saveError } = await supabase
      .from("patients")
      .update({
        eligibility_status: result.status,
        eligibility_checked_at: result.verified_at,
      })
      .eq("id", patient.id)

    if (saveError) {
      setError("Failed to save eligibility result: " + saveError.message)
    } else {
      onStatusUpdate(result.status)
    }

    setStage("done")
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Insurance Eligibility
          </h2>
          {patient?.eligibility_checked_at && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last checked: {new Date(patient.eligibility_checked_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[patient?.eligibility_status || "unverified"]}`}>
          {patient?.eligibility_status || "unverified"}
        </span>
      </div>

      {!hasInsurance ? (
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            Please add your insurance information before verifying eligibility.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Provider</p>
              <p className="font-medium text-slate-700">{patient.insurance_provider}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Member ID</p>
              <p className="font-medium text-slate-700">{patient.member_id}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Plan Type</p>
              <p className="font-medium text-slate-700">{patient.plan_type || "Not specified"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Group Number</p>
              <p className="font-medium text-slate-700">{patient.group_number || "Not specified"}</p>
            </div>
          </div>

          {stage === "prescreening" && (
            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <p className="text-sm font-medium text-blue-700">AI pre-screening insurance data...</p>
              </div>
            </div>
          )}

          {preScreenResult && stage !== "idle" && (
            <div className={`mb-4 rounded-lg p-4 ${preScreenResult.canProceed ? "bg-blue-50" : "bg-red-50"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">AI Pre-Screen Result</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  preScreenResult.confidence >= 80 ? "bg-green-100 text-green-700" :
                  preScreenResult.confidence >= 50 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {preScreenResult.confidence}% confidence
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{preScreenResult.recommendation}</p>
              {preScreenResult.issues.map((issue, i) => (
                <p key={i} className="text-sm text-red-600">Issue: {issue}</p>
              ))}
              {preScreenResult.warnings.map((warn, i) => (
                <p key={i} className="text-sm text-amber-600">Warning: {warn}</p>
              ))}
            </div>
          )}

          {stage === "verifying" && (
            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <p className="text-sm font-medium text-blue-700">Verifying eligibility with payer...</p>
              </div>
            </div>
          )}

          {eligibilityResult && (
            <div className={`mb-4 rounded-lg p-4 ${
              eligibilityResult.status === "eligible" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}>
              <p className={`text-sm font-semibold mb-2 ${
                eligibilityResult.status === "eligible" ? "text-green-800" : "text-red-800"
              }`}>
                {eligibilityResult.status === "eligible" ? "Insurance Eligible" : "Insurance Ineligible"}
              </p>
              {eligibilityResult.status === "eligible" ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Deductible:</span> <span className="font-medium">{eligibilityResult.deductible}</span></div>
                  <div><span className="text-slate-500">Met:</span> <span className="font-medium">{eligibilityResult.deductible_met}</span></div>
                  <div><span className="text-slate-500">Copay:</span> <span className="font-medium">{eligibilityResult.copay}</span></div>
                  <div><span className="text-slate-500">OOP Max:</span> <span className="font-medium">{eligibilityResult.out_of_pocket_max}</span></div>
                  <div className="col-span-2"><span className="text-slate-500">Verification ID:</span> <span className="font-medium">{eligibilityResult.verification_id}</span></div>
                </div>
              ) : (
                <p className="text-sm text-red-700">{eligibilityResult.reason}</p>
              )}
            </div>
          )}

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={stage === "prescreening" || stage === "verifying" || stage === "saving"}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {stage === "prescreening" ? "AI Pre-Screening..." :
             stage === "verifying" ? "Verifying with Payer..." :
             stage === "saving" ? "Saving Result..." :
             stage === "done" ? "Verify Again" :
             "Verify Insurance Eligibility"}
          </button>
        </>
      )}
    </div>
  )
}
