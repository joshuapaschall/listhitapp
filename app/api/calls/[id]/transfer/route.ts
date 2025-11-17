import { NextRequest, NextResponse } from "next/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { to } = await request.json()
    const callControlId = params.id

    if (!to) {
      return NextResponse.json({ error: "Transfer destination required" }, { status: 400 })
    }

    console.log(`🔀 Transferring call ${callControlId} to ${to}`)

    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/transfer`,
      {
        method: "POST",
        headers: telnyxHeaders(),
        body: JSON.stringify({
          to,
          // Optionally add:
          // from: "+1234567890", // Override caller ID
          // answering_machine_detection: "disabled"
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ Transfer failed:", data)
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || "Transfer failed" },
        { status: response.status }
      )
    }

    console.log("✅ Call transferred successfully")
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("❌ Transfer error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
