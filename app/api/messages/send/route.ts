import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { scheduleSMS, lookupCarrier } from "@/lib/sms-rate-limiter"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { upsertAnonThread } from "@/services/thread-utils"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"

export async function POST(request: NextRequest) {
  const { buyerId, to, body, mediaUrls } = await request.json()

  if (
    !to ||
    (!body?.trim() && (!Array.isArray(mediaUrls) || mediaUrls.length === 0))
  ) {
    return new Response(
      JSON.stringify({ error: "to and either body or mediaUrls are required" }),
      { status: 400 },
    )
  }

  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID

  if (!getTelnyxApiKey() || !messagingProfileId) {
    return new Response(JSON.stringify({ error: "Telnyx not configured" }), {
      status: 500,
    })
  }

  const url = `${TELNYX_API_URL}/messages`
  const formatted = formatPhoneE164(to)
  if (!formatted) {
    return new Response(JSON.stringify({ error: "Invalid phone number" }), {
      status: 400,
    })
  }
  let finalMediaUrls: string[] | undefined
  if (Array.isArray(mediaUrls) && mediaUrls.length) {
    try {
      finalMediaUrls = await ensurePublicMediaUrls(mediaUrls, "outgoing")
    } catch (err: any) {
      console.error("Failed to mirror media", err)
      return new Response(JSON.stringify({ error: err.message }), { status: 400 })
    }
  }
  const digits = normalizePhone(formatted)
  if (!digits) {
    return new Response(JSON.stringify({ error: "Invalid phone number" }), {
      status: 400,
    })
  }

  let existingThread: { id: string; preferred_from_number: string | null } | null =
    null
  const baseThreadQuery = supabase
    .from("message_threads")
    .select("id, preferred_from_number")
    .eq("phone_number", digits)
    .is("campaign_id", null)
    .limit(1)

  const threadResult =
    buyerId == null
      ? await baseThreadQuery.is("buyer_id", null).maybeSingle()
      : await baseThreadQuery.eq("buyer_id", buyerId).maybeSingle()

  if (threadResult.error) {
    console.error("Failed to fetch thread", threadResult.error)
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
    })
  }
  existingThread = threadResult.data

  let fromDid = existingThread?.preferred_from_number || null

  if (!fromDid && existingThread?.id) {
    const lastMessage = await supabase
      .from("messages")
      .select("direction, from_number, to_number")
      .eq("thread_id", existingThread.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastMessage.error) {
      console.error("Failed to fetch last message", lastMessage.error)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }
    if (lastMessage.data) {
      fromDid =
        lastMessage.data.direction === "inbound"
          ? lastMessage.data.to_number
          : lastMessage.data.from_number
    }
  }

  if (!fromDid && process.env.DEFAULT_OUTBOUND_DID) {
    fromDid = process.env.DEFAULT_OUTBOUND_DID
  }

  if (!fromDid) {
    return new Response(JSON.stringify({ error: "No from number configured" }), {
      status: 400,
    })
  }

  const replyFrom = formatPhoneE164(fromDid) || fromDid

  const payload: Record<string, any> = {
    from: replyFrom,
    to: formatted,
    text: body,
    messaging_profile_id: messagingProfileId,
  }
  if (finalMediaUrls && finalMediaUrls.length) {
    payload.media_urls = finalMediaUrls
  }

  const carrier = (await lookupCarrier(formatted)) || "unknown"
  const sendRequest = async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error("Telnyx error", text)
      let msg = `Telnyx API error: ${res.status}`
      try {
        const data = JSON.parse(text)
        if (data.errors && data.errors[0]?.detail) msg = data.errors[0].detail
      } catch {}
      throw new Error(msg)
    }
    const json = await res.json()
    const data = json.data as { id: string; from: any }
    const from =
      typeof data.from === "string" ? data.from : data.from?.phone_number || ""
    return { id: data.id, from }
  }

  try {
    const data = await scheduleSMS(carrier, body, sendRequest)

    const { data: thread, error: threadErr } =
      buyerId == null
        ? await upsertAnonThread(digits, replyFrom)
        : await supabase
            .from("message_threads")
            .upsert(
              {
                buyer_id: buyerId,
                phone_number: digits,
                campaign_id: null,
                updated_at: new Date().toISOString(),
                preferred_from_number: replyFrom,
              },
              { onConflict: "buyer_id,phone_number" },
            )
            .select("id")
            .single()
    if (threadErr || !thread) {
      console.error("Failed to upsert thread", threadErr)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }

    const { error: insertErr } = await supabase.from("messages").insert({
      thread_id: thread.id,
      buyer_id: buyerId ?? null,
      direction: "outbound",
      from_number: formatPhoneE164(data.from) || data.from,
      to_number: formatted,
      body,
      provider_id: data.id,
      is_bulk: false,
      media_urls: finalMediaUrls && finalMediaUrls.length ? finalMediaUrls : null,
    })
    if (insertErr) {
      console.error("Failed to record message", insertErr)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }

    return new Response(JSON.stringify({ sid: data.id }), { status: 200 })
  } catch (err: any) {
    console.error("Failed to send message", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
