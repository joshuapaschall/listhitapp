import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { requirePermission } from "@/lib/permissions/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"

export const runtime = "nodejs"

// Hang up a specific PSTN/call_control leg server-side. Used to tear down the
// far party (prospect/customer) when the agent ends the call from the browser —
// otherwise that leg keeps ringing. The [id] is the call_control_id.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "calls.make_receive")
  if (denied) return denied

  if (!getTelnyxApiKey()) {
    return new Response(JSON.stringify({ error: "Telnyx not configured" }), { status: 500 })
  }

  const callControlId = params.id
  if (!callControlId) {
    return new Response(JSON.stringify({ error: "call control id required" }), { status: 400 })
  }

  try {
    const url = `${TELNYX_API_URL}/calls/${encodeURIComponent(callControlId)}/actions/hangup`
    const payload = { command_id: crypto.randomUUID() }
    const res = await fetch(url, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error("Telnyx hangup error", text)
      return new Response(text, { status: res.status })
    }
    return new Response(text, { status: 200 })
  } catch (err: any) {
    console.error("Hangup call error", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
