import { NextRequest, NextResponse } from "next/server"
import { processEmailQueue } from "@/services/campaign-sender"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing auth header" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEmailQueue()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error("email-queue/process failed", err)
    return NextResponse.json(
      { error: err?.message || "Failed to process email queue" },
      { status: 500 },
    )
  }
}
