import { NextRequest, NextResponse } from "next/server"
import { processEmailQueue } from "@/services/campaign-sender"
import { assertServer } from "@/utils/assert-server"

assertServer()

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

  const body = await request.json().catch(() => ({}))
  const limit = typeof body?.limit === "number" ? body.limit : 10

  try {
    const result = await processEmailQueue(limit)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("process email queue failed", err)
    return NextResponse.json({ error: err?.message || "Queue failure" }, { status: 500 })
  }
}
