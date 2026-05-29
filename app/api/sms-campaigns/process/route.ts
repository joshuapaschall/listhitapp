import { NextRequest, NextResponse } from "next/server"
import { processSmsQueue } from "@/services/sms-campaign-sender"
import { assertCronAuth } from "@/lib/cron-auth"
import { assertServer } from "@/utils/assert-server"

assertServer()

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const body = await request.json().catch(() => ({}))
  const limit = typeof body?.limit === "number" ? body.limit : 50

  try {
    const TIME_BUDGET_MS = 270_000
    const startedAt = Date.now()
    let totalProcessed = 0
    let totalSent = 0
    let batches = 0

    while (Date.now() - startedAt < TIME_BUDGET_MS) {
      const { processed, sent } = await processSmsQueue(limit)
      totalProcessed += processed
      totalSent += sent
      batches += 1
      if (processed === 0) break
    }

    return NextResponse.json({
      processed: totalProcessed,
      sent: totalSent,
      batches,
      budgetMsConsumed: Date.now() - startedAt,
    })
  } catch (err: any) {
    console.error("process SMS queue failed", err)
    return NextResponse.json({ error: err?.message || "Queue failure" }, { status: 500 })
  }
}

export const GET = POST
