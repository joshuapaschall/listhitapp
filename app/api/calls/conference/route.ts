import { NextRequest, NextResponse } from "next/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(request: NextRequest) {
  try {
    const { callControlId, command, conferenceId, ...options } = await request.json()

    if (!callControlId || !command) {
      return NextResponse.json(
        { error: "Call control ID and command required" },
        { status: 400 }
      )
    }

    console.log(`🎯 Conference command: ${command} for call ${callControlId}`)

    let endpoint: string
    let body: any = {}

    switch (command) {
      case "join":
        // Join an existing conference or create a new one
        endpoint = `${TELNYX_API_URL}/calls/${callControlId}/actions/join_conference`
        body = {
          name: conferenceId || `conf_${Date.now()}`,
          hold_audio_url: options.holdMusicUrl,
          start_conference_on_enter: true,
          end_conference_on_exit: options.endOnExit || false,
          mute: options.mute || false,
          supervisor_role: options.supervisor || "participant",
          // Additional options:
          // beep_enabled: "always" | "on_enter" | "on_exit" | "never"
          // comfort_noise: true
        }
        break

      case "leave":
        // Leave the conference
        endpoint = `${TELNYX_API_URL}/calls/${callControlId}/actions/leave_conference`
        break

      case "hold":
        // Put conference participant on hold
        endpoint = `${TELNYX_API_URL}/conferences/${conferenceId}/actions/hold`
        body = { call_control_ids: [callControlId] }
        break

      case "unhold":
        // Resume conference participant
        endpoint = `${TELNYX_API_URL}/conferences/${conferenceId}/actions/unhold`
        body = { call_control_ids: [callControlId] }
        break

      case "mute":
        // Mute participant in conference
        endpoint = `${TELNYX_API_URL}/conferences/${conferenceId}/actions/mute`
        body = { call_control_ids: [callControlId] }
        break

      case "unmute":
        // Unmute participant in conference
        endpoint = `${TELNYX_API_URL}/conferences/${conferenceId}/actions/unmute`
        body = { call_control_ids: [callControlId] }
        break

      default:
        return NextResponse.json({ error: "Invalid command" }, { status: 400 })
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`❌ Conference ${command} failed:`, data)
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || `Conference ${command} failed` },
        { status: response.status }
      )
    }

    console.log(`✅ Conference ${command} successful`)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("❌ Conference error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET endpoint to list conference participants
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conferenceId = searchParams.get("conferenceId")

    if (!conferenceId) {
      return NextResponse.json({ error: "Conference ID required" }, { status: 400 })
    }

    const response = await fetch(
      `${TELNYX_API_URL}/conferences/${conferenceId}`,
      { headers: telnyxHeaders() }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ Failed to get conference details:", data)
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || "Failed to get conference" },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("❌ Conference fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
