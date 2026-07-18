import { NextRequest, NextResponse } from "next/server"
import { assertCronAuth } from "@/lib/cron-auth"
import { evaluateAccountState, type AccountState } from "@/lib/email/deliverability-guard"
import { insertNotification } from "@/lib/notifications"
import { getSesAccountHealth } from "@/lib/ses-account"
import { isGuardOverrideActive } from "@/lib/email/guard-override"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const WINDOW_DAYS = 14

async function getExactCount(query: PromiseLike<{ count: number | null; error: any }>) {
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

async function getRollingCounts(windowStart: string) {
  const [windowSent, hardBounces, complaints] = await Promise.all([
    getExactCount(
      supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .not("sent_at", "is", null)
        .gte("sent_at", windowStart),
    ),
    getExactCount(
      supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .not("sent_at", "is", null)
        .gte("sent_at", windowStart)
        .eq("bounce_type", "Permanent"),
    ),
    getExactCount(
      supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .not("sent_at", "is", null)
        .gte("sent_at", windowStart)
        .not("complained_at", "is", null),
    ),
  ])

  return { windowSent, hardBounces, complaints }
}

async function readPreviousState(): Promise<AccountState | null> {
  const { data, error } = await supabaseAdmin
    .from("ses_reputation_snapshots")
    .select("sending_state")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const state = data?.sending_state
  return state === "healthy" || state === "warn" || state === "frozen" ? state : null
}

async function pauseAllEmailSending() {
  const [campaignsResult, queueResult] = await Promise.all([
    supabaseAdmin
      .from("campaigns")
      .update({ status: "paused_by_safety" })
      .in("status", ["processing", "pending"]),
    supabaseAdmin
      .from("email_campaign_queue")
      .update({
        status: "paused",
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
      })
      .in("status", ["pending", "processing"]),
  ])

  if (campaignsResult.error) throw campaignsResult.error
  if (queueResult.error) throw queueResult.error
}

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  try {
    const [counts, health, previousState] = await Promise.all([
      getRollingCounts(windowStart),
      getSesAccountHealth(),
      readPreviousState(),
    ])
    const verdict = evaluateAccountState({
      ...counts,
      enforcementStatus: health.enforcementStatus,
      sendingEnabled: health.sendingEnabled,
    })

    const snapshot = {
      sending_state: verdict.state,
      reason: verdict.reason,
      enforcement_status: health.enforcementStatus,
      sending_enabled: health.sendingEnabled,
      account_bounce_rate: verdict.bounceRate,
      account_complaint_rate: verdict.complaintRate,
      window_sent: counts.windowSent,
      raw: {
        windowDays: WINDOW_DAYS,
        windowStart,
        counts,
        health,
      },
    }

    const { error: insertError } = await supabaseAdmin
      .from("ses_reputation_snapshots")
      .insert(snapshot)

    if (insertError) throw insertError

    if (verdict.state === "frozen" && previousState !== "frozen") {
      const overridden = await isGuardOverrideActive()
      if (!overridden) {
        await pauseAllEmailSending()
      }
      await insertNotification({
        type: "account_sending_frozen",
        title: overridden ? "Reputation still high (override active)" : "Email sending frozen",
        body: overridden
          ? `Bounce/complaint rate still above safe levels (${verdict.reason}), but a manual override is keeping sending on. Clean your list — the override expires soon.`
          : `Account reputation guard tripped (${verdict.reason}). All campaigns paused.`,
        metadata: {
          reason: verdict.reason,
          bounceRate: verdict.bounceRate,
          complaintRate: verdict.complaintRate,
          enforcementStatus: health.enforcementStatus,
          overrideActive: overridden,
        },
      })
    } else if (verdict.state === "warn" && previousState === "healthy") {
      await insertNotification({
        type: "account_reputation_warn",
        title: "Email reputation warning",
        body: `Approaching limits (${verdict.reason}).`,
        metadata: {
          reason: verdict.reason,
          bounceRate: verdict.bounceRate,
          complaintRate: verdict.complaintRate,
          enforcementStatus: health.enforcementStatus,
        },
      })
    }

    return NextResponse.json({
      state: verdict.state,
      reason: verdict.reason,
      bounceRate: verdict.bounceRate,
      complaintRate: verdict.complaintRate,
      previousState,
      counts,
      health,
    })
  } catch (err: any) {
    console.error("SES reputation cron failed", err)
    return NextResponse.json(
      { error: "Failed to evaluate SES reputation", detail: err?.message || String(err) },
      { status: 500 },
    )
  }
}

export const GET = POST
