import { supabase } from "./supabase"

// Cache role lookups per user so we don't hit the DB on every single log call
const roleCache = {}

async function getActorRole(userId) {
  if (roleCache[userId]) return roleCache[userId]

  const { data } = await supabase
    .from("patients")
    .select("role")
    .eq("id", userId)
    .single()

  const role = data?.role ?? null
  roleCache[userId] = role
  return role
}

/**
 * Writes one row to audit_logs. Never throws — a logging failure should
 * never block the user's actual task, so errors are swallowed and logged
 * to the console instead.
 *
 * @param {object} params
 * @param {"view"|"create"|"update"|"delete"|"export"} params.action
 * @param {string} params.resourceType - e.g. "patients", "visits", "insurance_card"
 * @param {string} [params.resourceId]
 * @param {string} [params.patientId] - whose PHI this action touched
 * @param {string} [params.description] - human-readable detail, no raw PHI values
 */
export async function logAudit({ action, resourceType, resourceId = null, patientId = null, description = null }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const actorRole = await getActorRole(user.id)

    const { error } = await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: actorRole,
      patient_id: patientId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })

    if (error) console.error("audit log failed:", error.message)
  } catch (err) {
    console.error("audit log failed:", err)
  }
}
