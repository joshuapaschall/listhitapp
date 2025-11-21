import { NextRequest } from "next/server"

import { formatPhoneE164 } from "@/lib/dedup-utils"
import { supabase } from "@/lib/supabase"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { ensurePublicMediaUrls } from "@/utils/mms.server"

export async function POST(request: NextRequest) {
  const {
    buyerId,
    threadId,
    to,
    from,
    body,
    mediaUrls,
    sendAt,
  } = await request.json()

  if (
    !threadId ||
    !to ||
    !sendAt ||
    (!body?.trim() && (!Array.isArray(mediaUrls) || mediaUrls.length === 0))
  ) {
    return new Response(
      JSON.stringify({
        error: "threadId, to, sendAt and either body or mediaUrls are required",
      }),
      { status: 400 },
    )
  }

  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!getTelnyxApiKey() || !messagingProfileId) {
    return new Response(JSON.stringify({ error: "Telnyx not configured" }), {
      status: 500,
    })
  }

  const toE164 = formatPhoneE164(to)
  const replyFromE164 = formatPhoneE164(from)
  if (!toE164 || !replyFromE164) {
    return new Response(JSON.stringify({ error: "Invalid phone number" }), {
      status: 400,
    })
  }

  let finalMediaUrls: string[] = []
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
      return new Response(JSON.stringify({ error: err.message || "error" }), {
        status: 400,
      })
    }
  }

  const payload: Record<string, any> = {
    from: replyFromE164,
    to: toE164,
    text: body,
    messaging_profile_id: messagingProfileId,
    type: finalMediaUrls.length ? "MMS" : "SMS",
    use_profile_webhooks: true,
    send_at: sendAt,
  }
  if (finalMediaUrls.length) {
    payload.media_urls = finalMediaUrls
  }

  const url = `${TELNYX_API_URL}/messages/schedule`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
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
      } catch {}
      return new Response(JSON.stringify({ error: msg }), { status: res.status })
    }

    const json = text ? JSON.parse(text) : {}
    const data = json.data as { id: string } | undefined

    const { data: inserted, error: insertErr } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        buyer_id: buyerId ?? null,
        direction: "outbound",
        from_number: replyFromE164,
        to_number: toE164,
        body,
        provider_id: data?.id,
        is_bulk: false,
        media_urls: finalMediaUrls.length ? finalMediaUrls : null,
        status: "scheduled",
        created_at: new Date().toISOString(),
      })
      .select("id, created_at")
      .single()

    if (insertErr || !inserted) {
      console.error("Failed to record scheduled message", insertErr)
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
      })
    }

    return new Response(
      JSON.stringify({ id: inserted.id, sid: data?.id, created_at: inserted.created_at }),
      { status: 200 },
    )
  } catch (err: any) {
    console.error("Failed to schedule message", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: 500,
    })
  }
}
