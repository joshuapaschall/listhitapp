import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const DEFAULT_LEASE_SECONDS = 300

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = auth.split(" ")[1]
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const leaseSeconds =
    typeof body?.leaseSeconds === "number" && body.leaseSeconds > 0
      ? body.leaseSeconds
      : DEFAULT_LEASE_SECONDS

  const { data, error } = await supabaseAdmin.rpc("requeue_stuck_email_jobs", {
    p_stuck_seconds: leaseSeconds,
  })

  if (error) {
    console.error("requeue stuck email jobs failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requeued: data?.length || 0, jobs: data || [] })
}
