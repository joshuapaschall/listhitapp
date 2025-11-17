import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
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

  try {
    // Save call record to database only (no actual call)
    const callRecord = {
      buyer_id: buyerId || null,
      direction: direction,
      from_number: formattedFrom,
      to_number: formattedTo,
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

    const { data, error } = await supabase.from("calls").insert(callRecord).select().single()

    if (error) {
      console.error("Failed to save call record:", error)
      return new Response(JSON.stringify({ error: "Failed to save call record" }), {
        status: 500,
      })
    }

    // Save caller ID mapping for future calls if this is a new buyer-number combination
    if (buyerId) {
      try {
        const { data: existing } = await supabase
          .from("buyer_sms_senders")
          .select("from_number")
          .eq("buyer_id", buyerId)
          .maybeSingle()

        if (!existing?.from_number) {
          await supabase.from("buyer_sms_senders").insert({
            buyer_id: buyerId,
            from_number: formattedFrom,
          })
        }
      } catch (err) {
        console.warn("Failed to save caller ID mapping:", err)
      }
    }

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