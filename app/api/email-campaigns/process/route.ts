import { NextRequest, NextResponse } from "next/server"
import { processEmailQueue } from "@/services/campaign-sender"
import { assertCronAuth } from "@/lib/cron-auth"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
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
