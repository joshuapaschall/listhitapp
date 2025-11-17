import { NextRequest, NextResponse } from "next/server"

import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getCallControlAppId } from "@/lib/voice-env"

// Conference bridge configuration
export async function POST(request: NextRequest) {
  try {
    const { action, phoneNumber } = await request.json()

    if (action === "create") {
      // Create a conference bridge
      const response = await fetch(`${TELNYX_API_URL}/conferences`, {
        method: "POST",
        headers: telnyxHeaders(),
        body: JSON.stringify({
          name: `bridge_${Date.now()}`,
        }),
      })

      const data = await response.json()
      return NextResponse.json(data)
    }

    if (action === "dial") {
      // Dial out to a participant and add them to conference
      const connectionId = getCallControlAppId()

      if (!connectionId) {
        return NextResponse.json(
          { ok: false, error: "Missing CALL_CONTROL_APP_ID" },
          { status: 500 },
        )
      }

      console.log("[bridge] connection_id =>", connectionId)

      const response = await fetch(`${TELNYX_API_URL}/calls`, {
        method: "POST",
        headers: telnyxHeaders(),
        body: JSON.stringify({
          to: phoneNumber,
          from: process.env.TELNYX_PHONE_NUMBER,
          connection_id: connectionId,
          answering_machine_detection: "disabled",
          webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/conference-dial`,
        }),
      })

      const data = await response.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Conference bridge error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
