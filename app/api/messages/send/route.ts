import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { scheduleSMS, lookupCarrier } from "@/lib/sms-rate-limiter"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { resolveOutboundFrom, recordStickyFrom } from "@/lib/sender/sticky-sender"

export async function POST(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  if (!orgId) return new Response(JSON.stringify({ error: "Missing org" }), { status: 400 })

  const denied = await requirePermission(supabase, "inbox.send")
  if (denied) return denied

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

  if (buyerId != null) {
    const { data, error } = await supabase
      .from("buyers")
      .select("id")
      .eq("id", buyerId)
      .maybeSingle()
    if (error) {
      console.error("Failed to fetch buyer", error)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "Buyer not found" }), {
        status: 404,
      })
    }
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

  const replyFrom = await resolveOutboundFrom({
    client: supabase,
    buyerId,
    threadId: thread?.id,
    explicitFrom: overrideFrom,
  })

  if (!replyFrom) {
    return new Response(JSON.stringify({ error: "No from number resolved" }), {
      status: 400,
    })
  }

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
    if (isMms) {
      console.info("[messages/send] Telnyx MMS payload", {
        type: payload.type,
        media_urls: payload.media_urls,
      })
    }
    const res = await fetch(url, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      if (isMms) {
        console.error("[messages/send] Telnyx MMS error body", text)
      }
      let msg = `Telnyx API error: ${res.status}`
      try {
        const data = JSON.parse(text)
        if (Array.isArray(data.errors) && data.errors.length) {
          const details = data.errors
            .map((e: any) => e?.detail || e?.title || e?.code)
            .filter(Boolean)
          if (details.length) msg = details.join("; ")
        } else if (data.error?.message) {
          msg = data.error.message
        }
      } catch (err) {
        console.error("messages/send: failed to parse Telnyx error response:", err)
      }
      throw new Error(msg)
    }
    const json = text ? JSON.parse(text) : {}
    const data = json.data as { id: string; from: any }
    const from =
      typeof data.from === "string" ? data.from : data.from?.phone_number || ""
    return { id: data.id, from }
  }

  try {
    const data = await scheduleSMS(carrier, body, sendRequest)

    // Ensure the thread exists. The sticky from-number (preferred_from_number) is
    // written once, by recordStickyFrom below — the single source of truth.
    const ensureThread = async () => {
      if (thread?.id) {
        const { data, error } = await supabase
          .from("message_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", thread.id)
          .select("id, preferred_from_number")
          .single()
        if (error || !data) throw error || new Error("Thread update failed")
        thread = data
        return data
      }

      if (buyerId == null) {
        const res = await supabase
          .from("message_threads")
          .upsert(
            {
              buyer_id: null,
              phone_number: digits,
              campaign_id: null,
              unread: true,
              updated_at: new Date().toISOString(),
              deleted_at: null,
              org_id: orgId,
            },
            { onConflict: "phone_number" },
          )
          .select("id, preferred_from_number")
          .single()
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
            org_id: orgId,
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
      org_id: orgId,
    })
    if (insertErr) {
      console.error("Failed to record message", insertErr)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }

    // Single sticky writer — keeps buyer_sms_senders + thread.preferred_from_number in lockstep.
    await recordStickyFrom({
      client: supabase,
      buyerId,
      threadId: activeThread.id,
      from: replyFrom,
    })

    return new Response(JSON.stringify({ sid: data.id }), { status: 200 })
  } catch (err: any) {
    console.error("Failed to send message", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
