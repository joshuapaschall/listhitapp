import { NextRequest, NextResponse } from "next/server"
import { assertCronAuth } from "@/lib/cron-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

export const maxDuration = 300

const DEFAULT_STUCK_SECONDS = 300
const DEFAULT_LIMIT = 50

export async function POST(request: NextRequest) {
  // Auth: CRON_SECRET (or service-role) bearer enforced via assertCronAuth.
  try {
    assertCronAuth(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const stuckSeconds =
    typeof body?.stuckSeconds === "number" && body.stuckSeconds > 0
      ? body.stuckSeconds
      : DEFAULT_STUCK_SECONDS
  const limit =
    typeof body?.limit === "number" && body.limit > 0 ? body.limit : DEFAULT_LIMIT

  const { data, error } = await supabaseAdmin.rpc("requeue_stuck_sms_jobs", {
    p_limit: limit,
    p_stuck_seconds: stuckSeconds,
  })

  if (error) {
    console.error("requeue stuck SMS jobs failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requeued: data ?? 0 })
}

export const GET = POST
