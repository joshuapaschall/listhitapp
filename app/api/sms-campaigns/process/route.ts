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
  const limit = typeof body?.limit === "number" ? body.limit : 10

  try {
    const result = await processSmsQueue(limit)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("process SMS queue failed", err)
    return NextResponse.json({ error: err?.message || "Queue failure" }, { status: 500 })
  }
}
