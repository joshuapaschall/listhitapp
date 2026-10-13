import { apiError } from "@/lib/api-error"
import { NextRequest } from "next/server"

import { formatPhoneE164 } from "@/lib/dedup-utils"
import { requirePermission } from "@/lib/permissions/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { getSmsReadiness, SmsNotReadyError } from "@/lib/providers/sms"
import { loadRoutingState } from "@/lib/providers/routing-state"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"

// Twilio only accepts a scheduled send between 15 minutes and 35 days out.
const TWILIO_MIN_LEAD_MS = 15 * 60 * 1000
const TWILIO_MAX_LEAD_MS = 35 * 24 * 60 * 60 * 1000

async function mirrorMedia(mediaUrls: unknown): Promise<string[] | Response> {
  if (!Array.isArray(mediaUrls) || !mediaUrls.length) return []
  try {
    const finalMediaUrls = await ensurePublicMediaUrls(mediaUrls, "outgoing")
    if (!finalMediaUrls || finalMediaUrls.length < mediaUrls.length) {
      const mediaError =
        finalMediaUrls?.length === 0
          ? "Attachments could not be processed. Please try different files."
          : "Some attachments could not be processed. Please try again."
      return new Response(JSON.stringify({ error: mediaError }), { status: 422 })
    }
    return finalMediaUrls
  } catch (err: any) {
    console.error("Failed to mirror media", err)
    return apiError(err, 400)
  }
}

// Tenant (non-pinned) orgs schedule through their own Twilio Messaging Service.
// A tenant whose texting isn't live gets 409 sms_not_ready — never Telnyx.
async function scheduleViaTwilio(args: {
  orgId: string
  supabase: any
  buyerId: string | null | undefined
  threadId: string
  to: string
  from: string | null | undefined
  body: string
  mediaUrls: unknown
  sendAt: string
}): Promise<Response> {
  const { orgId, supabase, buyerId, threadId, body, sendAt } = args

  if ((await getSmsReadiness(orgId)) !== "twilio") {
    const err = new SmsNotReadyError()
    return new Response(JSON.stringify({ error: err.message, code: err.code }), { status: err.status })
  }
  const state = await loadRoutingState(orgId)
  const messagingServiceSid = state?.messaging_service_sid
  if (!messagingServiceSid) {
    const err = new SmsNotReadyError()
    return new Response(JSON.stringify({ error: err.message, code: err.code }), { status: err.status })
  }

  const toE164 = formatPhoneE164(args.to)
  if (!toE164) {
    return new Response(JSON.stringify({ error: "Invalid phone number" }), { status: 400 })
  }

  const sendAtDate = new Date(sendAt)
  const lead = sendAtDate.getTime() - Date.now()
  if (!Number.isFinite(lead) || lead < TWILIO_MIN_LEAD_MS || lead > TWILIO_MAX_LEAD_MS) {
    return new Response(
      JSON.stringify({ error: "Schedule texts between 15 minutes and 35 days from now.", code: "schedule_window" }),
      { status: 400 },
    )
  }

  const media = await mirrorMedia(args.mediaUrls)
  if (media instanceof Response) return media

  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const statusCallback = base ? `${base}/api/webhooks/twilio-status` : undefined

  try {
    const client = await getTwilioClientForOrg(orgId)
    const msg = await client.messages.create({
      messagingServiceSid,
      to: toE164,
      body,
      sendAt: sendAtDate,
      scheduleType: "fixed",
      ...(media.length ? { mediaUrl: media } : {}),
      ...(statusCallback ? { statusCallback } : {}),
    })

    const { data: inserted, error: insertErr } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        buyer_id: buyerId ?? null,
        direction: "outbound",
        // The Messaging Service picks the sender at send time.
        from_number: formatPhoneE164(args.from) || null,
        to_number: toE164,
        body,
        provider_id: msg.sid,
        is_bulk: false,
        media_urls: media.length ? media : null,
        status: "scheduled",
        org_id: orgId,
        created_at: new Date().toISOString(),
      })
      .select("id, created_at")
      .single()

    if (insertErr || !inserted) {
      console.error("Failed to record scheduled message", insertErr)
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ id: inserted.id, sid: msg.sid, created_at: inserted.created_at }),
      { status: 200 },
    )
  } catch (err: any) {
    console.error("Failed to schedule message", err)
    return apiError(err, 500)
  }
}

export async function POST(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  if (!orgId) {
    return new Response(JSON.stringify({ error: "Organization context required" }), { status: 400 })
  }
  const denied = await requirePermission(supabase, "inbox.send")
  if (denied) return denied

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

  // Only the pinned owner org schedules through Telnyx; the path below is the
  // original owner path, unchanged.
  if (!isOrgTelnyxPinnedEnv(orgId)) {
    return scheduleViaTwilio({ orgId, supabase, buyerId, threadId, to, from, body, mediaUrls, sendAt })
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
      return apiError(err, 400)
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
      } catch (err) {
        console.error("messages/schedule: failed to parse Telnyx error response:", err)
      }
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
        org_id: orgId,
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
    return apiError(err, 500)
  }
}
