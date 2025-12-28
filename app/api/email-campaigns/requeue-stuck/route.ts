import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const DEFAULT_STUCK_SECONDS = 300
const DEFAULT_LIMIT = 50

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = auth.split(" ")[1]
  const allowedTokens = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(
    Boolean,
  )
  if (!allowedTokens.includes(token)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  const { data, error } = await supabaseAdmin.rpc("requeue_stuck_email_jobs", {
    p_limit: limit,
    p_stuck_seconds: stuckSeconds,
  })

  if (error) {
    console.error("requeue stuck email jobs failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requeued: data ?? 0 })
}
