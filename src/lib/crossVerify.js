// Cross-verification logic: compares data extracted from a scanned driver's
// license / government ID against the patient's on-file profile (and, where
// relevant, their insurance card's policy holder name) to catch mismatched
// or fraudulent identity information before check-in completes.
//
// This is deliberately separated from the scanner UI components so it can
// be unit-tested and swapped out independently as matching rules evolve.

const NAME_MATCH_THRESHOLD = 0.82 // similarity score to count two names as "matching"

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Lightweight Levenshtein-based similarity, 0..1 (1 = identical).
function stringSimilarity(a, b) {
  a = normalizeName(a)
  b = normalizeName(b)
  if (!a || !b) return 0
  if (a === b) return 1

  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }

  const distance = dp[m][n]
  return 1 - distance / Math.max(m, n)
}

function datesMatch(a, b) {
  if (!a || !b) return false
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)
}

/**
 * @param {object} params
 * @param {object} params.idData - { full_name, date_of_birth } extracted from the scanned ID
 * @param {object} params.patientRecord - the patient's profile row { full_name, date_of_birth }
 * @param {object} [params.insuranceRecord] - optional { policy_holder } if the insurance card names a different policy holder than the patient
 * @returns {{status: 'verified'|'partial_match'|'mismatch', score: number, checks: Array}}
 */
export function crossVerifyIdentity({ idData, patientRecord, insuranceRecord = null }) {
  const checks = []

  const nameSimilarity = stringSimilarity(idData.full_name, patientRecord.full_name)
  checks.push({
    field: "full_name",
    id_value: idData.full_name,
    record_value: patientRecord.full_name,
    match: nameSimilarity >= NAME_MATCH_THRESHOLD,
    similarity: Math.round(nameSimilarity * 100) / 100,
  })

  const dobMatch = datesMatch(idData.date_of_birth, patientRecord.date_of_birth)
  checks.push({
    field: "date_of_birth",
    id_value: idData.date_of_birth,
    record_value: patientRecord.date_of_birth,
    match: dobMatch,
  })

  // If the insurance card lists a policy holder (e.g. a parent/spouse) that's
  // different from the patient themselves, that's expected — not a mismatch —
  // so we only flag it as informational, never as a failure on its own.
  if (insuranceRecord?.policy_holder) {
    const policyHolderSimilarity = stringSimilarity(idData.full_name, insuranceRecord.policy_holder)
    checks.push({
      field: "insurance_policy_holder",
      id_value: idData.full_name,
      record_value: insuranceRecord.policy_holder,
      match: policyHolderSimilarity >= NAME_MATCH_THRESHOLD,
      similarity: Math.round(policyHolderSimilarity * 100) / 100,
      informational: true, // doesn't affect overall status — patient may be a dependent
    })
  }

  const coreChecks = checks.filter((c) => !c.informational)
  const passedCount = coreChecks.filter((c) => c.match).length

  let status
  if (passedCount === coreChecks.length) status = "verified"
  else if (passedCount > 0) status = "partial_match"
  else status = "mismatch"

  const score = Math.round((passedCount / coreChecks.length) * 100)

  return { status, score, checks }
}
