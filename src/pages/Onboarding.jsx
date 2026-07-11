import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "ur", label: "Urdu" },
  { code: "fr", label: "French" },
  { code: "zh", label: "Mandarin" },
]

const PLAN_TYPES = ["HMO", "PPO", "EPO", "POS", "Medicare", "Medicaid", "Other"]

const step1Schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
})

const step2Schema = z.object({
  insurance_provider: z.string().min(1, "Insurance provider is required"),
  member_id: z.string().min(1, "Member ID is required"),
  group_number: z.string().optional(),
  plan_type: z.string().min(1, "Plan type is required"),
  policy_holder: z.string().optional(),
})

const step3Schema = z.object({
  preferred_language: z.string().min(1, "Please select a language"),
})

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [serverError, setServerError] = useState(null)

  const schemas = [null, step1Schema, step2Schema, step3Schema]

  const form1 = useForm({ resolver: zodResolver(step1Schema) })
  const form2 = useForm({ resolver: zodResolver(step2Schema) })
  const form3 = useForm({ resolver: zodResolver(step3Schema) })
  const forms = [null, form1, form2, form3]
  const { register, handleSubmit, formState: { errors, isSubmitting } } = forms[step]

  const onNext = (data) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setStep((prev) => prev + 1)
  }

  const onSubmit = async (data) => {
    setServerError(null)
    const finalData = { ...formData, ...data, onboarding_complete: true }
    const { error } = await supabase
      .from("patients")
      .update(finalData)
      .eq("id", user.id)

    if (error) setServerError(error.message)
    else navigate("/programs")
  }

  const steps = ["Personal Info", "Insurance", "Preferences"]

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-700">Kinentry</span>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Welcome! Let us set up your profile</h1>
          <p className="mt-1 text-sm text-slate-500">Complete these steps before accessing programs</p>
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
                  {step > index + 1 ? "+" : index + 1}
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
            <form onSubmit={handleSubmit(onNext)} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
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
              <button type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Next: Insurance Details
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit(onNext)} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Insurance Information</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Insurance provider</label>
                <input type="text" {...register("insurance_provider")} placeholder="e.g. Blue Cross Blue Shield"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {errors.insurance_provider && <p className="mt-1 text-sm text-red-600">{errors.insurance_provider.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Member ID</label>
                  <input type="text" {...register("member_id")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {errors.member_id && <p className="mt-1 text-sm text-red-600">{errors.member_id.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Group number</label>
                  <input type="text" {...register("group_number")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plan type</label>
                <select {...register("plan_type")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Select plan type</option>
                  {PLAN_TYPES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {errors.plan_type && <p className="mt-1 text-sm text-red-600">{errors.plan_type.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Policy holder name</label>
                <input type="text" {...register("policy_holder")} placeholder="If different from patient"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Back
                </button>
                <button type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Next: Preferences
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Language Preference</h2>
              <p className="text-sm text-slate-500">Select your preferred language for forms and communications.</p>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map((lang) => (
                  <label key={lang.code}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300">
                    <input type="radio" {...register("preferred_language")} value={lang.code}
                      className="text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{lang.label}</span>
                  </label>
                ))}
              </div>
              {errors.preferred_language && <p className="mt-1 text-sm text-red-600">{errors.preferred_language.message}</p>}
              {serverError && <p className="text-sm text-red-600">{serverError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Back
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Complete Setup"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
