import { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"

export async function POST(request: NextRequest) {
  const { 
    buyerId, 
    to, 
    callerId, 
    direction = "outbound", 
    webrtc = false,
    validationResult 
  } = await request.json()

  if (!to) {
    return new Response(JSON.stringify({ error: "to is required" }), {
      status: 400,
    })
  }

  if (!callerId) {
    return new Response(JSON.stringify({ error: "callerId is required" }), {
      status: 400,
    })
  }

  // Format phone numbers
  const formattedTo = formatPhoneE164(to) || to
  const formattedFrom = formatPhoneE164(callerId) || callerId

  // Webhook (no user session): derive the org from the inbound DID via voice_numbers.
  // For outbound calls the DID is the caller ID; for inbound it's the destination.
  // If the number can't be resolved, leave org_id null rather than failing the webhook.
  let orgId: string | null = null
  try {
    const didCandidates = Array.from(
      new Set([formattedFrom, formattedTo].filter((n): n is string => Boolean(n))),
    )
    if (didCandidates.length) {
      const { data: voiceNumber } = await supabaseAdmin
        .from("voice_numbers")
        .select("org_id")
        .in("phone_number", didCandidates)
        .not("org_id", "is", null)
        .limit(1)
        .maybeSingle()
      orgId = voiceNumber?.org_id ?? null
    }
  } catch (err) {
    console.warn("calls/record: failed to resolve org from voice_numbers:", err)
  }

  if (!orgId) {
    console.warn("calls/record: could not resolve org for call", { formattedFrom, formattedTo })
  }

  try {
    // Save call record to database only (no actual call)
    const callRecord: any = {
      buyer_id: buyerId || null,
      direction: direction,
      from_number: formattedFrom,
      to_number: formattedTo,
      org_id: orgId,
      started_at: new Date().toISOString(),
      call_sid: `webrtc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID for WebRTC calls
      webrtc: webrtc
    };

    // Add validation metadata if provided
    if (validationResult) {
      callRecord.notes = JSON.stringify({
        validation: {
          warnings: validationResult.warnings || [],
          metadata: validationResult.metadata || {}
        }
      });
    }

    const { data, error } = await supabaseAdmin.from("calls").insert(callRecord).select().single()

    if (error) {
      console.error("Failed to save call record:", error)
      return new Response(JSON.stringify({ error: "Failed to save call record" }), {
        status: 500,
      })
    }

    // Calls never write the SMS sticky store — it is owned exclusively by the SMS
    // send paths via recordStickyFrom.

    return new Response(JSON.stringify({
      success: true, 
      callId: data.id,
      callSid: data.call_sid 
    }), {
      status: 200,
    })
  } catch (err) {
    console.error("Error saving call record:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    })
  }
}