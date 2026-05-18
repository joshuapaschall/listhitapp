// @ts-nocheck
import { NextRequest } from "next/server"
import { verifyTelnyxRequest } from "@/lib/telnyx"
import { processTelnyxStatusEvent } from "@/lib/telnyx-status-processor"

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifyTelnyxRequest(request, raw)) {
    return new Response("Invalid signature", { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  return processTelnyxStatusEvent(body)
}
