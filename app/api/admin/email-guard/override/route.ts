import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  createGuardOverride,
  clearGuardOverride,
  getActiveGuardOverride,
} from "@/lib/email/guard-override"
import { processEmailQueue } from "@/services/campaign-sender"
import { createLogger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300
const log = createLogger("api:email-guard-override")

// Latest reputation snapshot state + active override, for the Email Domains page.
export async function GET() {
  const { user, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "settings.email_domains")
  if (denied) return denied

  const [{ data: snapshot }, override] = await Promise.all([
    supabaseAdmin
      .from("ses_reputation_snapshots")
      .select("sending_state")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getActiveGuardOverride(),
  ])

  const sendingState = snapshot?.sending_state ?? null
  return NextResponse.json({
    ok: true,
    sendingState,
    frozen: sendingState === "frozen",
    override: override ? { overrideUntil: override.override_until } : null,
  })
}

export async function POST(request: Request) {
  const { user, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "settings.email_domains")
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const hours = Number(body?.hours) || 2
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null

  const override = await createGuardOverride({ hours, reason, createdBy: user.id })

  // Resume every campaign/queue the guard auto-paused, account-wide.
  const [campaigns, queue] = await Promise.all([
    supabaseAdmin.from("campaigns").update({ status: "processing" }).eq("status", "paused_by_safety").select("id"),
    supabaseAdmin
      .from("email_campaign_queue")
      .update({ status: "pending", locked_at: null, lock_expires_at: null, locked_by: null })
      .eq("status", "paused")
      .select("id"),
  ])
  if (campaigns.error) log.error("resume campaigns failed", campaigns.error)
  if (queue.error) log.error("resume queue failed", queue.error)

  // Kick the queue once so sending starts immediately.
  try {
    await processEmailQueue(3)
  } catch (err) {
    log.error("processEmailQueue after override failed", err)
  }

  return NextResponse.json({
    ok: true,
    overrideUntil: override.override_until,
    resumedCampaigns: campaigns.data?.length ?? 0,
    resumedQueue: queue.data?.length ?? 0,
  })
}

export async function DELETE() {
  const { user, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "settings.email_domains")
  if (denied) return denied
  await clearGuardOverride()
  return NextResponse.json({ ok: true })
}
