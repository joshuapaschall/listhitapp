import { NextRequest, NextResponse } from "next/server"

import { assertCronAuth } from "@/lib/cron-auth"
import { advanceRegistration } from "@/lib/org-twilio/engine"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BATCH = 25

// Polling fallback for Event Streams: advance every org whose registration is
// in flight and due for a check. Sequential (Twilio's brand/campaign API allows
// ~1 request per second), one try/catch per org so one failure never stops the batch.
export async function POST(req: NextRequest) {
  try {
    assertCronAuth(req)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from("org_twilio")
    .select("org_id, next_check_at")
    .in("setup_stage", ["submitting", "in_review", "verify_mobile"])
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(BATCH)

  if (error) {
    console.error("[cron:twilio-registration] query failed", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const results: Array<{ orgId: string; stage?: string; error?: boolean }> = []
  for (const row of (data ?? []) as Array<{ org_id: string }>) {
    try {
      const result = await advanceRegistration(row.org_id, { reason: "cron" })
      results.push({ orgId: row.org_id, stage: result.stage })
    } catch (err) {
      console.error("[cron:twilio-registration] advance failed", { orgId: row.org_id }, err)
      results.push({ orgId: row.org_id, error: true })
    }
  }

  return NextResponse.json({ checked: results.length, results })
}

export const GET = POST
