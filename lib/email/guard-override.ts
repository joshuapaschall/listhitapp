import { supabaseAdmin } from "@/lib/supabase/admin"
import { createLogger } from "@/lib/logger"

const log = createLogger("email:guard-override")

export type GuardOverride = {
  id: string
  override_until: string
  reason: string | null
  created_by: string | null
  created_at: string
}

// The latest override whose window has not expired, or null.
export async function getActiveGuardOverride(): Promise<GuardOverride | null> {
  const { data, error } = await supabaseAdmin
    .from("email_guard_overrides")
    .select("*")
    .gt("override_until", new Date().toISOString())
    .order("override_until", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    log.error("getActiveGuardOverride failed", error)
    return null // fail closed: no override → guard behaves normally (safe)
  }
  return (data as GuardOverride) ?? null
}

export async function isGuardOverrideActive(): Promise<boolean> {
  return (await getActiveGuardOverride()) !== null
}

export async function createGuardOverride(input: {
  hours: number
  reason: string | null
  createdBy: string | null
}): Promise<GuardOverride> {
  const hours = Math.min(24, Math.max(1, Math.floor(input.hours || 2)))
  const overrideUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from("email_guard_overrides")
    .insert({ override_until: overrideUntil, reason: input.reason, created_by: input.createdBy })
    .select("*")
    .single()
  if (error) throw error
  return data as GuardOverride
}

// Expire any active override immediately (set override_until to now).
export async function clearGuardOverride(): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from("email_guard_overrides")
    .update({ override_until: nowIso })
    .gt("override_until", nowIso)
  if (error) throw error
}
