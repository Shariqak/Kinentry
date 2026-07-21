// Shared helpers for the Intake Queue — pulled out of the page component so
// they're independently testable (and reusable, e.g. for a future Reports page).

export const UNRESOLVED_STATUSES = ['pending', 'under_review', 'needs_correction']

export function formatAge(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function isAtRisk(caseRow, thresholdDays = 3) {
  if (!UNRESOLVED_STATUSES.includes(caseRow.status)) return false
  const ageMs = Date.now() - new Date(caseRow.created_at).getTime()
  return ageMs > thresholdDays * 24 * 60 * 60 * 1000
}
