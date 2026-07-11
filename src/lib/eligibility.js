// src/lib/eligibility.js
// Simulated eligibility verification with AI-style pre-screening
// Replace simulateEligibilityCheck with real Availity API call when ready
// Replace aiPreScreen with real Claude API call via Supabase Edge Function when ready

const KNOWN_PAYERS = [
  "blue cross blue shield", "bcbs", "aetna", "cigna", "united health",
  "unitedhealthcare", "humana", "molina", "centene", "anthem",
  "kaiser", "medicare", "medicaid", "tricare", "cvs health"
]

const MEMBER_ID_PATTERNS = {
  "aetna": /^[A-Z]{1}[0-9]{8,10}$/i,
  "cigna": /^[0-9]{9}$/,
  "bcbs": /^[A-Z]{3}[0-9]{9}$/i,
  "default": /^[A-Z0-9]{6,15}$/i
}

// AI pre-screening layer
// Validates insurance data before expensive API call
export function aiPreScreen(insuranceData) {
  const issues = []
  const warnings = []
  let confidence = 100

  const { insurance_provider, member_id, group_number, plan_type } = insuranceData

  // Check 1: Known payer validation
  const providerLower = (insurance_provider || "").toLowerCase()
  const isKnownPayer = KNOWN_PAYERS.some((p) => providerLower.includes(p))
  if (!isKnownPayer) {
    warnings.push("Insurance provider not recognized — verify spelling")
    confidence -= 20
  }

  // Check 2: Member ID format validation
  if (!member_id || member_id.length < 6) {
    issues.push("Member ID is too short — must be at least 6 characters")
    confidence -= 40
  } else {
    const pattern = MEMBER_ID_PATTERNS[providerLower] || MEMBER_ID_PATTERNS.default
    if (!pattern.test(member_id)) {
      warnings.push("Member ID format may not match this payer")
      confidence -= 15
    }
  }

  // Check 3: Plan type present
  if (!plan_type) {
    warnings.push("Plan type not specified")
    confidence -= 10
  }

  // Check 4: Provider name too short
  if (!insurance_provider || insurance_provider.length < 3) {
    issues.push("Insurance provider name is required")
    confidence -= 30
  }

  return {
    canProceed: issues.length === 0,
    confidence: Math.max(0, confidence),
    issues,
    warnings,
    recommendation: issues.length > 0
      ? "Fix the issues above before verifying eligibility"
      : confidence >= 80
      ? "Data looks good — proceeding to eligibility verification"
      : "Data has some concerns — verification will proceed but may fail"
  }
}

// Simulated eligibility check
// Replace this with real Availity/Waystar API call
export async function simulateEligibilityCheck(patientData) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2500))

  const { insurance_provider, member_id, plan_type } = patientData
  const providerLower = (insurance_provider || "").toLowerCase()
  const isKnownPayer = KNOWN_PAYERS.some((p) => providerLower.includes(p))

  // Simulate realistic eligibility outcomes
  // Known payer + valid member ID = 85% chance eligible
  // Unknown payer = 40% chance eligible
  const eligibilityChance = isKnownPayer ? 0.85 : 0.40
  const random = Math.random()

  if (random < eligibilityChance) {
    return {
      status: "eligible",
      payer_name: insurance_provider,
      plan_type: plan_type || "Unknown",
      member_id,
      coverage_active: true,
      deductible: "$" + (Math.floor(Math.random() * 3000) + 500),
      deductible_met: "$" + Math.floor(Math.random() * 500),
      copay: "$" + (Math.floor(Math.random() * 40) + 10),
      out_of_pocket_max: "$" + (Math.floor(Math.random() * 5000) + 3000),
      out_of_pocket_met: "$" + Math.floor(Math.random() * 1000),
      verification_id: "VER-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      verified_at: new Date().toISOString(),
    }
  } else if (random < eligibilityChance + 0.10) {
    return {
      status: "ineligible",
      reason: "Coverage terminated — patient is no longer active on this plan",
      payer_name: insurance_provider,
      member_id,
      verified_at: new Date().toISOString(),
    }
  } else {
    return {
      status: "ineligible",
      reason: "Member ID not found in payer system — verify insurance details",
      payer_name: insurance_provider,
      member_id,
      verified_at: new Date().toISOString(),
    }
  }
}
