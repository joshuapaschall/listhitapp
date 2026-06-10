import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import {
  ONBOARDING_STEPS,
  DERIVED_STEP_KEYS,
  getStepDef,
  type OnboardingStatus,
  type OnboardingStepDef,
  type OnboardingStepKey,
} from "@/lib/onboarding/steps"

export interface ResolvedStep extends OnboardingStepDef {
  status: OnboardingStatus
  locked: boolean
}

export interface OnboardingState {
  steps: ResolvedStep[]
  doneCount: number
  totalCount: number
  completed: boolean
}

// Statuses a client is allowed to write. profile/organization are derived and
// never writable.
const WRITABLE_STATUSES: OnboardingStatus[] = ["in_progress", "done", "skipped"]

function isNonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

// Resolve the full onboarding state for an org. profile/organization statuses are
// DERIVED from real data (full_name / business_name) — never stored, never faked.
// `userId`, when provided, derives the profile step from that specific user's
// profile; otherwise it falls back to any profile in the org.
export async function getOnboardingState(orgId: string, userId?: string): Promise<OnboardingState> {
  // Stored step rows (org-scoped).
  const { data: rows } = await supabaseAdmin
    .from("onboarding_progress")
    .select("step_key, status")
    .eq("org_id", orgId)

  const storedStatus = new Map<string, OnboardingStatus>()
  for (const row of rows || []) {
    storedStatus.set(row.step_key as string, row.status as OnboardingStatus)
  }

  // Organization business_name (org-scoped).
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("business_name")
    .eq("id", orgId)
    .maybeSingle()

  // Current user's profile full_name (org-scoped). Falls back to any org profile.
  let profileQuery = supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("org_id", orgId)
  if (userId) profileQuery = profileQuery.eq("id", userId)
  const { data: profile } = await profileQuery.maybeSingle()

  const profileDone = isNonEmpty(profile?.full_name)
  const orgDone = isNonEmpty(org?.business_name)

  const derived: Record<OnboardingStepKey, OnboardingStatus | undefined> = {
    profile: profileDone ? "done" : "not_started",
    organization: orgDone ? "done" : "not_started",
  } as Record<OnboardingStepKey, OnboardingStatus | undefined>

  // First pass: resolve each step's status.
  const statusByKey = new Map<OnboardingStepKey, OnboardingStatus>()
  for (const step of ONBOARDING_STEPS) {
    const status: OnboardingStatus = DERIVED_STEP_KEYS.includes(step.key)
      ? derived[step.key] ?? "not_started"
      : storedStatus.get(step.key) ?? "not_started"
    statusByKey.set(step.key, status)
  }

  // Second pass: compute locked (a step is locked when its dependency isn't done).
  const steps: ResolvedStep[] = ONBOARDING_STEPS.map((step) => {
    const status = statusByKey.get(step.key) ?? "not_started"
    const locked = step.dependsOn ? statusByKey.get(step.dependsOn) !== "done" : false
    return { ...step, status, locked }
  })

  // A counted step is "resolved" when it's done, or when an OPTIONAL step has been
  // skipped (a skipped optional fills its slot so the checklist can complete).
  // Required steps must still be done.
  const isResolved = (s: ResolvedStep) =>
    s.status === "done" || (s.optional && s.status === "skipped")

  const counted = steps.filter((s) => s.countsTowardProgress)
  const totalCount = counted.length
  const doneCount = counted.filter(isResolved).length

  return { steps, doneCount, totalCount, completed: doneCount === totalCount }
}

export interface UpsertResult {
  ok: boolean
  error?: string
}

// Persist a step status. Rejects derived (profile/organization) and unknown keys,
// and any status the client may not set. Sets started_at/completed_at to power the
// drop-off instrumentation.
export async function upsertStepStatus(
  orgId: string,
  stepKey: string,
  status: unknown,
): Promise<UpsertResult> {
  const def = getStepDef(stepKey)
  if (!def) return { ok: false, error: "Unknown step" }
  if (DERIVED_STEP_KEYS.includes(def.key)) return { ok: false, error: "Step is not writable" }
  if (typeof status !== "string" || !WRITABLE_STATUSES.includes(status as OnboardingStatus)) {
    return { ok: false, error: "Invalid status" }
  }
  const nextStatus = status as OnboardingStatus

  // Read the existing row so we only stamp started_at once and stamp completed_at
  // exactly when the step becomes done.
  const { data: existing } = await supabaseAdmin
    .from("onboarding_progress")
    .select("started_at, completed_at")
    .eq("org_id", orgId)
    .eq("step_key", def.key)
    .maybeSingle()

  const now = new Date().toISOString()
  const write: Record<string, unknown> = {
    org_id: orgId,
    step_key: def.key,
    status: nextStatus,
    updated_at: now,
  }

  if (nextStatus === "in_progress" && !existing?.started_at) write.started_at = now
  if (nextStatus === "done") write.completed_at = existing?.completed_at ?? now

  const { error } = await supabaseAdmin
    .from("onboarding_progress")
    .upsert(write, { onConflict: "org_id,step_key" })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
