import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { LanguageSwitcher, applyDirection } from "../components/LanguageSwitcher"
import { SUPPORTED_LANGUAGES } from "../i18n"

const PLAN_TYPES = ["HMO", "PPO", "EPO", "POS", "Medicare", "Medicaid", "Other"]

export default function Onboarding() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [errors, setErrors] = useState({})

  const [step1, setStep1] = useState({ full_name: "", date_of_birth: "", phone: "" })
  const [step2, setStep2] = useState({ insurance_provider: "", member_id: "", group_number: "", plan_type: "", policy_holder: "" })
  const [step3, setStep3] = useState({ preferred_language: "" })

  const validateStep1 = () => {
    const e = {}
    if (!step1.full_name) e.full_name = t("onboarding.personal.errors.fullName")
    if (!step1.date_of_birth) e.date_of_birth = t("onboarding.personal.errors.dateOfBirth")
    if (!step1.phone || step1.phone.length < 6) e.phone = t("onboarding.personal.errors.phone")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e = {}
    if (!step2.insurance_provider) e.insurance_provider = t("onboarding.insurance.errors.provider")
    if (!step2.member_id) e.member_id = t("onboarding.insurance.errors.memberId")
    if (!step2.plan_type) e.plan_type = t("onboarding.insurance.errors.planType")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e = {}
    if (!step3.preferred_language) e.preferred_language = t("onboarding.preferences.error")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext1 = () => {
    if (validateStep1()) { setErrors({}); setStep(2) }
  }

  const handleNext2 = () => {
    if (validateStep2()) { setErrors({}); setStep(3) }
  }

  // Selecting a language here previews it live across the onboarding UI —
  // not just saved as a preference for later.
  const handleSelectLanguage = (code) => {
    setStep3({ preferred_language: code })
    i18n.changeLanguage(code)
    applyDirection(code)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    setSaving(true)
    setServerError(null)
    const finalData = { ...step1, ...step2, ...step3, onboarding_complete: true }
    const { error } = await supabase
      .from("patients")
      .update(finalData)
      .eq("id", user.id)
    if (error) {
      setServerError("Save failed: " + error.message)
      setSaving(false)
      return
    }

    // Opens the patient's first insurance verification case — this is what
    // makes it show up in staff's intake queue as "pending".
    await supabase.from("insurance_verifications").insert({
      patient_id: user.id,
      status: "pending",
      payer_name: step2.insurance_provider || null,
      member_id: step2.member_id || null,
      group_number: step2.group_number || null,
      plan_type: step2.plan_type || null,
      reason: "Submitted during onboarding",
    })

    window.location.href = "/patient/programs"
  }

  const steps = [t("onboarding.steps.personal"), t("onboarding.steps.insurance"), t("onboarding.steps.preferences")]

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher onChange={(code) => setStep3((prev) => ({ ...prev, preferred_language: prev.preferred_language || code }))} />
        </div>
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-700">{t("appName")}</span>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{t("onboarding.welcomeTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("onboarding.welcomeSubtitle")}</p>
        </div>

        <div className="flex items-center justify-center mb-8">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step > index + 1 ? "bg-green-500 text-white" :
                  step === index + 1 ? "bg-blue-600 text-white" :
                  "bg-slate-200 text-slate-400"
                }`}>
                  {step > index + 1 ? "✓" : index + 1}
                </div>
                <span className={`mt-1 text-xs ${step === index + 1 ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 w-16 mx-2 mb-4 ${step > index + 1 ? "bg-green-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("onboarding.personal.title")}</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.personal.fullName")}</label>
                <input type="text" value={step1.full_name}
                  onChange={(e) => setStep1({ ...step1, full_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.personal.dateOfBirth")}</label>
                <input type="date" value={step1.date_of_birth}
                  onChange={(e) => setStep1({ ...step1, date_of_birth: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {errors.date_of_birth && <p className="mt-1 text-sm text-red-600">{errors.date_of_birth}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.personal.phone")}</label>
                <input type="tel" value={step1.phone}
                  onChange={(e) => setStep1({ ...step1, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>
              <button onClick={handleNext1}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                {t("onboarding.personal.next")}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("onboarding.insurance.title")}</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.insurance.provider")}</label>
                <input type="text" value={step2.insurance_provider} placeholder={t("onboarding.insurance.providerPlaceholder")}
                  onChange={(e) => setStep2({ ...step2, insurance_provider: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {errors.insurance_provider && <p className="mt-1 text-sm text-red-600">{errors.insurance_provider}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.insurance.memberId")}</label>
                  <input type="text" value={step2.member_id}
                    onChange={(e) => setStep2({ ...step2, member_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {errors.member_id && <p className="mt-1 text-sm text-red-600">{errors.member_id}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.insurance.groupNumber")}</label>
                  <input type="text" value={step2.group_number}
                    onChange={(e) => setStep2({ ...step2, group_number: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.insurance.planType")}</label>
                <select value={step2.plan_type}
                  onChange={(e) => setStep2({ ...step2, plan_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">{t("onboarding.insurance.selectPlanType")}</option>
                  {PLAN_TYPES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {errors.plan_type && <p className="mt-1 text-sm text-red-600">{errors.plan_type}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("onboarding.insurance.policyHolder")}</label>
                <input type="text" value={step2.policy_holder} placeholder={t("onboarding.insurance.policyHolderPlaceholder")}
                  onChange={(e) => setStep2({ ...step2, policy_holder: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {t("onboarding.insurance.back")}
                </button>
                <button onClick={handleNext2}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  {t("onboarding.insurance.next")}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("onboarding.preferences.title")}</h2>
              <p className="text-sm text-slate-500">{t("onboarding.preferences.subtitle")}</p>
              <div className="grid grid-cols-2 gap-3">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <label key={lang.code}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                      step3.preferred_language === lang.code ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                    }`}>
                    <input type="radio" name="preferred_language" value={lang.code}
                      checked={step3.preferred_language === lang.code}
                      onChange={(e) => handleSelectLanguage(e.target.value)}
                      className="text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{lang.nativeLabel}</span>
                  </label>
                ))}
              </div>
              {errors.preferred_language && <p className="mt-1 text-sm text-red-600">{errors.preferred_language}</p>}
              {serverError && <p className="text-sm text-red-600">{serverError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {t("onboarding.preferences.back")}
                </button>
                <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t("onboarding.preferences.submitting") : t("onboarding.preferences.submit")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
