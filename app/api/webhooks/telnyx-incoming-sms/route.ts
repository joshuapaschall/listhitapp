// app/api/webhooks/telnyx-incoming-sms/route.ts
/**
 * Handles inbound Telnyx SMS/MMS webhooks and stores them in Supabase.
 * – GET  ➜ 200 OK        (health-check / Telnyx warm-up)
 * – POST ➜ 204 No Content (normal) or 4xx/5xx on errors
 */

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { verifyTelnyxRequest } from "@/lib/telnyx"
import { upsertAnonThread } from "@/services/thread-utils"

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
    return new NextResponse(null, { status: 204 })
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
      // Don't crash the webhook; we'll just save the text part.
      mediaUrls = []
    }
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

  const isStop = /^stop/i.test(text)

  const { data: buyers, error: buyerErr } = await supabase
    .from("buyers")
    .select("id, can_receive_sms")
    .or(orClause)

  if (buyerErr) {
    console.error("❌ Supabase buyers error", buyerErr)
    return new NextResponse("Supabase error", { status: 500 })
  }

  const buyerIds = buyers?.map((b) => b.id) ?? []
  const targetIds = buyerIds.length ? buyerIds : [null]

  for (const buyerId of targetIds) {
    let campaignId: string | null = null
    if (buyerId) {
      const { data: rec } = await supabase
        .from("campaign_recipients")
        .select("campaign_id")
        .eq("buyer_id", buyerId)
        .eq("from_number", to)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      campaignId = rec?.campaign_id ?? null
    }

    const { data: thread, error: threadErr } = buyerId
      ? await supabase
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

    const { error: msgErr } = await supabase.from("messages").insert({
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
  }

  if (isStop && buyerIds.length) {
    const { error: updErr } = await supabase
      .from("buyers")
      .update({ can_receive_sms: false })
      .in("id", buyerIds)

    if (updErr) {
      console.error("❌ STOP update error", updErr)
      return new NextResponse("Supabase error", { status: 500 })
    }
  }

  console.log("✅ Telnyx webhook processed OK")
  return new NextResponse(null, { status: 204 })
}
