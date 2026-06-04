// app/api/webhooks/telnyx-incoming-sms/route.ts
/**
 * Handles inbound Telnyx SMS/MMS webhooks and stores them in Supabase.
 * – GET  ➜ 200 OK        (health-check / Telnyx warm-up)
 * – POST ➜ 204 No Content (normal) or 4xx/5xx on errors
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { TELNYX_API_URL, telnyxHeaders, verifyTelnyxRequest } from "@/lib/telnyx"
import { upsertAnonThread } from "@/services/thread-utils"
import { processTelnyxStatusEvent } from "@/lib/telnyx-status-processor"
import { classifyInboundSms } from "@/lib/sms/opt-keywords"
import { matchNegativeKeyword } from "@/lib/sms/negative-keywords"
import { suppressBuyerSms } from "@/lib/sms/suppress"
import { recordDncPhone } from "@/lib/dnc/phones"

export const runtime = "nodejs"

assertServer()

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  console.log("📨 Telnyx webhook hit", {
    path: request.nextUrl.pathname,
    length: rawBody.length,
    headers: Object.fromEntries(request.headers),
  })

  if (!verifyTelnyxRequest(request, rawBody)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error("❌ JSON parse error:", err)
    return new NextResponse("Bad JSON", { status: 400 })
  }

  const event = body?.data?.event_type as string | undefined
  if (event !== "message.received") {
    // Outbound message lifecycle event (message.sent, message.delivered,
    // message.delivery_failed, message.finalized, etc.) — Telnyx delivers
    // these to the same inbound URL since there's no separate outbound URL
    // field on the messaging profile. Route to the status processor.
    console.log("[telnyx-incoming-sms] forwarding outbound event to status processor", { event })
    return processTelnyxStatusEvent(body)
  }

  const payload = body.data.payload
  if (!payload) {
    console.warn("⚠️ Payload missing:", body)
    return new NextResponse("No payload", { status: 400 })
  }

  const from =
    typeof payload.from === "string"
      ? payload.from
      : payload.from?.phone_number
  const to = Array.isArray(payload.to)
    ? payload.to[0]?.phone_number
    : typeof payload.to === "string"
    ? payload.to
    : payload.to?.phone_number
  const preferredDid = to ? formatPhoneE164(to) || to : null
  const text = (payload.text as string | undefined)?.trim() ?? ""
  const rawMediaUrls = [
    ...(Array.isArray(payload.media)
      ? payload.media.map((m: any) => m.url)
      : []),
    ...(Array.isArray(payload.media_urls) ? payload.media_urls : []),
  ]
  const sid = payload.id as string | undefined

  // ✅ Mirror incoming media to Supabase
  let mediaUrls: string[] = []
  if (rawMediaUrls.length) {
    console.log("📎 Incoming media URLs", rawMediaUrls)
    try {
      mediaUrls = await ensurePublicMediaUrls(rawMediaUrls, "incoming")
    } catch (err) {
      console.error("Failed to mirror incoming media", err)
      // Fallback so we still persist the message even if mirroring fails.
      mediaUrls = rawMediaUrls
    }
  }

  if (!text && !mediaUrls.length && !rawMediaUrls.length) {
    console.log("[telnyx-incoming] dropping empty inbound message with no media")
    return NextResponse.json({ received: true, skipped: true }, { status: 200 })
  }

  if (!from) {
    console.warn("⚠️ Missing 'from' field")
    return new NextResponse("Missing from", { status: 400 })
  }

  const fromDigits = normalizePhone(from)
  if (!fromDigits) {
    console.warn("⚠️ Could not normalize phone:", from)
    return new NextResponse(null, { status: 204 })
  }

  const altDigits = fromDigits.length === 10 ? `1${fromDigits}` : fromDigits
  const encodedFrom = encodeURIComponent(fromDigits)
  const encodedAlt = encodeURIComponent(altDigits)
  const orClause = [
    `phone_norm.eq.${encodedFrom}`,
    `phone_norm.eq.${encodedAlt}`,
    `phone2_norm.eq.${encodedFrom}`,
    `phone2_norm.eq.${encodedAlt}`,
    `phone3_norm.eq.${encodedFrom}`,
    `phone3_norm.eq.${encodedAlt}`,
  ].join(",")

  const intent = classifyInboundSms(text)
  const isStop = intent === "stop"

  const { data: buyers, error: buyerErr } = await supabaseAdmin
    .from("buyers")
    .select("id, can_receive_sms, blocked_at, org_id")
    .or(orClause)

  if (buyerErr) {
    console.error("❌ Supabase buyers error", buyerErr)
    return new NextResponse("Supabase error", { status: 500 })
  }

  // Bidirectional block: a blocked buyer's inbound SMS is dropped entirely — no
  // message insert, no thread upsert, no notification (STOP/HELP included).
  if (buyers?.some((b) => b.blocked_at)) {
    return NextResponse.json({ received: true, blocked: true }, { status: 200 });
  }

  const buyerIds = buyers?.map((b) => b.id) ?? []
  const targetIds = buyerIds.length ? buyerIds : [null]
  const buyerOrgById = new Map<string, string | null>(
    (buyers ?? []).map((b) => [b.id, (b as any).org_id ?? null]),
  )
  let helpReplyThread: { id: string; buyerId: string } | null = null

  for (const buyerId of targetIds) {
    let campaignId: string | null = null
    let lastCampaignRecipient: { id: string; replied_at: string | null; unsubscribed_at: string | null } | null = null
    if (buyerId) {
      const { data: rec } = await supabaseAdmin
        .from("campaign_recipients")
        .select("id, campaign_id, replied_at, unsubscribed_at")
        .eq("buyer_id", buyerId)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      campaignId = rec?.campaign_id ?? null
      if (rec?.id) {
        lastCampaignRecipient = {
          id: rec.id,
          replied_at: rec.replied_at,
          unsubscribed_at: rec.unsubscribed_at,
        }
      }
    }

    const { data: thread, error: threadErr } = buyerId
      ? await supabaseAdmin
          .from("message_threads")
          .upsert(
            {
              buyer_id: buyerId,
              phone_number: fromDigits,
              campaign_id: campaignId,
              unread: true,
              updated_at: new Date().toISOString(),
              deleted_at: null,
              preferred_from_number: preferredDid,
            },
            { onConflict: "buyer_id,phone_number" }
          )
          .select("id")
          .single()
      : await upsertAnonThread(fromDigits, preferredDid)

    if (threadErr || !thread) {
      console.error("❌ Thread upsert error", threadErr)
      return new NextResponse("Supabase error", { status: 500 })
    }

    const { error: msgErr } = await supabaseAdmin.from("messages").insert({
      thread_id: thread.id,
      buyer_id: buyerId,
      direction: "inbound",
      from_number: from,
      to_number: to,
      body: text,
      provider_id: sid,
      is_bulk: false,
      media_urls: mediaUrls.length ? mediaUrls : null,
    })

    if (msgErr) {
      console.error("❌ Message insert error", {
        message: msgErr.message,
        detail: msgErr.details,
      })
      return new NextResponse("Supabase error", { status: 500 })
    }

    if (intent === "help" && buyerId && !helpReplyThread) {
      helpReplyThread = { id: thread.id, buyerId }
    }

    // Negative-keyword / STOP soft-filtering for the inbox Filtered tab.
    // Real buyers only (skip anon threads). Non-blocking: never fail the webhook.
    if (buyerId) {
      try {
        const orgId = buyerOrgById.get(buyerId) ?? null
        if (orgId) {
          const { data: threadState } = await supabaseAdmin
            .from("message_threads")
            .select("filtered_at, filter_overridden")
            .eq("id", thread.id)
            .maybeSingle()
          const overridden = threadState?.filter_overridden === true
          const nowIso = new Date().toISOString()

          if (isStop) {
            // STOP is owned by the carrier classifier; here we just tuck the
            // thread into Filtered. No keyword matching for STOP messages.
            if (!overridden) {
              await supabaseAdmin
                .from("message_threads")
                .update({ filtered_at: nowIso, filtered_keyword_id: null })
                .eq("id", thread.id)
            }
          } else {
            const match = await matchNegativeKeyword(supabaseAdmin, orgId, text)
            if (match) {
              if (!overridden) {
                await supabaseAdmin
                  .from("message_threads")
                  .update({ filtered_at: nowIso, filtered_keyword_id: match.keywordId })
                  .eq("id", thread.id)
              }
              if (match.action === "dnc") {
                // SMS channel only — the reply arrived by SMS.
                await suppressBuyerSms(buyerId, `keyword:"${match.keyword}"`)
                await recordDncPhone(supabaseAdmin, orgId, from, "keyword", `keyword:"${match.keyword}"`)
              }
            } else if (threadState?.filtered_at && !overridden) {
              // Auto-resurface: they messaged again with no matching keyword.
              // The thread upsert already set unread: true, so it returns as unread.
              await supabaseAdmin
                .from("message_threads")
                .update({ filtered_at: null, filtered_keyword_id: null })
                .eq("id", thread.id)
            }
          }
        }
      } catch (filterErr) {
        console.error(
          "[telnyx-incoming-sms] negative-keyword filtering failed (non-blocking)",
          filterErr,
        )
      }
    }

    // A.5 — Tag the inbound back to its originating campaign
    if (lastCampaignRecipient) {
      const recipientUpdates: Record<string, any> = {}
      if (!lastCampaignRecipient.replied_at) {
        recipientUpdates.replied_at = new Date().toISOString()
      }
      if (isStop && !lastCampaignRecipient.unsubscribed_at) {
        recipientUpdates.unsubscribed_at = new Date().toISOString()
      }
      if (Object.keys(recipientUpdates).length > 0) {
        const { error: crUpdateErr } = await supabaseAdmin
          .from("campaign_recipients")
          .update(recipientUpdates)
          .eq("id", lastCampaignRecipient.id)
        if (crUpdateErr) {
          console.error("❌ Failed to update campaign_recipient on inbound", crUpdateErr)
        }
      }
    }
  }

  if (isStop && buyerIds.length) {
    // STOP suppresses SMS with a reason and records the number on the DNC
    // blocklist. Non-blocking — never fail the webhook on it.
    try {
      for (const stopBuyerId of buyerIds) {
        await suppressBuyerSms(stopBuyerId, "stop_reply")
        const stopOrgId = buyerOrgById.get(stopBuyerId) ?? null
        if (stopOrgId) {
          await recordDncPhone(supabaseAdmin, stopOrgId, from, "stop", "stop_reply")
        }
      }
    } catch (stopErr) {
      console.error("[telnyx-incoming-sms] STOP DNC recording failed (non-blocking)", stopErr)
    }
  }

  if (intent === "start") {
    const optedOutBuyerIds =
      buyers
        ?.filter((buyer) => buyer.can_receive_sms === false)
        .map((buyer) => buyer.id) ?? []

    if (optedOutBuyerIds.length) {
      const { error: startErr } = await supabaseAdmin
        .from("buyers")
        .update({ can_receive_sms: true })
        .in("id", optedOutBuyerIds)

      if (startErr) {
        console.error("❌ START update error", startErr)
        return new NextResponse("Supabase error", { status: 500 })
      }
    }
  }

  if (intent === "help") {
    const replyText =
      process.env.SMS_HELP_AUTO_REPLY ||
      "ListHit notifications. Msg & data rates may apply. Reply STOP to cancel. Contact: support@listhit.io"
    const fromNumber = to ? formatPhoneE164(to) : null
    const toNumber = formatPhoneE164(from)

    if (!fromNumber || !toNumber) {
      console.warn("⚠️ HELP auto-reply skipped due to invalid phone numbers", {
        from,
        to,
      })
    } else {
      try {
        const response = await fetch(`${TELNYX_API_URL}/messages`, {
          method: "POST",
          headers: telnyxHeaders(),
          body: JSON.stringify({
            from: fromNumber,
            to: toNumber,
            text: replyText,
            messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Telnyx HELP auto-reply failed: ${response.status} ${errorText}`)
        }

        const json = await response.json()
        const providerId = json?.data?.id as string | undefined

        if (helpReplyThread) {
          const { error: helpMsgErr } = await supabaseAdmin.from("messages").insert({
            thread_id: helpReplyThread.id,
            buyer_id: helpReplyThread.buyerId,
            direction: "outbound",
            from_number: fromNumber,
            to_number: toNumber,
            body: replyText,
            provider_id: providerId,
            is_bulk: false,
          })

          if (helpMsgErr) {
            console.error("❌ Failed to record HELP auto-reply", helpMsgErr)
          }
        }
      } catch (err) {
        console.error("❌ HELP auto-reply send error", err)
      }
    }
  }

  console.log("✅ Telnyx webhook processed OK")
  return new NextResponse(null, { status: 204 })
}
