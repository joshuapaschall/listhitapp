import { NextRequest } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { scheduleSMS, lookupCarrier } from "@/lib/sms-rate-limiter"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { upsertAnonThread } from "@/services/thread-utils"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"

export async function POST(request: NextRequest) {
  const { buyerId, threadId, to, body, mediaUrls, from: overrideFrom } =
    await request.json()

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
      if (!finalMediaUrls || finalMediaUrls.length < mediaUrls.length) {
        const mediaError =
          finalMediaUrls?.length === 0
            ? "Attachments could not be processed. Please try different files."
            : "Some attachments could not be processed. Please try again."
        return new Response(JSON.stringify({ error: mediaError }), {
          status: 422,
        })
      }
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

  let thread: { id: string; preferred_from_number: string | null } | null =
    null
  if (threadId) {
    const { data, error } = await supabase
      .from("message_threads")
      .select("id, preferred_from_number")
      .eq("id", threadId)
      .maybeSingle()
    if (error) {
      console.error("Failed to fetch thread by id", error)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }
    thread = data
  }

  if (!thread) {
    const q = supabase
      .from("message_threads")
      .select("id, preferred_from_number, updated_at")
      .eq("phone_number", digits)
      .order("updated_at", { ascending: false })
      .limit(1)
    const { data, error } =
      buyerId == null
        ? await q.is("buyer_id", null).maybeSingle()
        : await q.eq("buyer_id", buyerId).maybeSingle()
    if (error) {
      console.error("Failed to resolve thread", error)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }
    thread = data
  }

  let fromDid: string | null = null
  if (overrideFrom) {
    const owned = normalizePhone(overrideFrom)
    if (owned) {
      let ok = true
      if (supabaseAdmin) {
        ok = false
        const formattedOwned = formatPhoneE164(owned)
        if (formattedOwned) {
          const { data: inbound, error: inboundErr } = await supabaseAdmin
            .from("inbound_numbers")
            .select("e164")
            .eq("enabled", true)
            .in("e164", [formattedOwned])
          if (!inboundErr && inbound && inbound.length) {
            ok = true
          }
        }
        if (!ok) {
          const matchValues = Array.from(
            new Set(
              [owned, formattedOwned].filter(
                (num): num is string => typeof num === "string",
              ),
            ),
          )
          if (matchValues.length) {
            const { data: voice, error: voiceErr } = await supabaseAdmin
              .from("voice_numbers")
              .select("phone_number")
              .in("phone_number", matchValues)
            if (!voiceErr && voice && voice.length) {
              ok = true
            }
          }
        }
      }
      if (ok) fromDid = owned
    }
  }

  if (!fromDid && thread?.preferred_from_number) {
    const norm = normalizePhone(thread.preferred_from_number)
    if (norm) fromDid = norm
  }

  if (!fromDid && thread?.id) {
    const { data: lastIn, error } = await supabase
      .from("messages")
      .select("to_number")
      .eq("thread_id", thread.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error("Failed to inspect inbound history", error)
    }
    const norm = normalizePhone(lastIn?.to_number)
    if (norm) fromDid = norm
  }

  if (!fromDid && buyerId) {
    const { data: sticky } = await supabase
      .from("buyer_sms_senders")
      .select("from_number")
      .eq("buyer_id", buyerId)
      .maybeSingle()
    const norm = normalizePhone(sticky?.from_number)
    if (norm) fromDid = norm
  }

  if (!fromDid && process.env.DEFAULT_OUTBOUND_DID) {
    fromDid = normalizePhone(process.env.DEFAULT_OUTBOUND_DID)
  }

  if (!fromDid) {
    return new Response(JSON.stringify({ error: "No from number resolved" }), {
      status: 400,
    })
  }

  const replyFrom = formatPhoneE164(fromDid)!
  const isMms = !!(finalMediaUrls && finalMediaUrls.length)

  const payload: Record<string, any> = {
    from: replyFrom,
    to: formatted,
    text: body,
    messaging_profile_id: messagingProfileId,
    type: isMms ? "MMS" : "SMS",
    use_profile_webhooks: true,
  }
  if (isMms) {
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

    const ensureThread = async () => {
      if (thread?.id) {
        const needsUpdate = thread.preferred_from_number !== replyFrom
        const { data, error } = await supabase
          .from("message_threads")
          .update({
            updated_at: new Date().toISOString(),
            preferred_from_number: replyFrom,
          })
          .eq("id", thread.id)
          .select("id, preferred_from_number")
          .single()
        if (error || !data) throw error || new Error("Thread update failed")
        thread = data
        if (!needsUpdate && data.preferred_from_number !== replyFrom) {
          thread = { ...data, preferred_from_number: replyFrom }
        }
        return data
      }

      if (buyerId == null) {
        const res = await upsertAnonThread(digits, replyFrom)
        if (res.error || !res.data)
          throw res.error || new Error("Thread upsert failed")
        thread = {
          id: res.data.id,
          preferred_from_number: res.data.preferred_from_number,
        }
        return thread
      }

      const res = await supabase
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
        .select("id, preferred_from_number")
        .single()
      if (res.error || !res.data) {
        console.error("Thread upsert failed", res.error)
        throw new Error("Database error")
      }
      thread = res.data
      return res.data
    }

    const activeThread = await ensureThread()

    const { error: insertErr } = await supabase.from("messages").insert({
      thread_id: activeThread.id,
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
