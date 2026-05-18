import { NextFetchEvent, NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { normalizeEmail, formatPhoneE164, mergeUnique } from "@/lib/dedup-utils"
import { resolveFromNumber } from "@/lib/showing-notifications"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

const ALLOWED_ORIGINS = [
  "https://georgiawholesalehomes.com",
  "https://www.georgiawholesalehomes.com",
  "http://localhost:3000",
  "http://localhost:3001",
]

const WELCOME_TEXT = "Welcome to Georgia Wholesale Homes. We'll text you off-market deals — investment properties at 30-50% under retail. Reply STOP to opt out. HELP for info."
const WINDOW_MS = 60_000
const LIMIT = 5
const ipHits = new Map<string, number[]>()

const bodySchema = z.object({
  fname: z.string().trim().min(1).max(50),
  lname: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().min(1),
  buyer_type: z.enum(["investor_cash", "fix_flip", "buy_hold", "wholesaler", "realtor", "first_time", "other"]),
  consent_text: z.string().min(50),
  source_url: z.string().url().optional(),
})

const BUYER_TYPE_MAPPING = {
  investor_cash: { investor: true, cash_buyer: true, first_time_buyer: false, tags: [] as string[] },
  fix_flip: { investor: true, cash_buyer: false, first_time_buyer: false, tags: ["fix-and-flip"] },
  buy_hold: { investor: true, cash_buyer: false, first_time_buyer: false, tags: ["buy-and-hold"] },
  wholesaler: { investor: false, cash_buyer: false, first_time_buyer: false, tags: ["wholesaler"] },
  realtor: { investor: false, cash_buyer: false, first_time_buyer: false, tags: ["realtor"] },
  first_time: { investor: false, cash_buyer: false, first_time_buyer: true, tags: [] },
  other: { investor: false, cash_buyer: false, first_time_buyer: false, tags: [] },
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

function errorResponse(status: number, origin: string, error_code: string, message: string) {
  return NextResponse.json({ ok: false, error_code, message }, { status, headers: corsHeaders(origin) })
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const existing = (ipHits.get(ip) || []).filter((ts) => now - ts < WINDOW_MS)
  if (existing.length >= LIMIT) {
    ipHits.set(ip, existing)
    return true
  }
  existing.push(now)
  ipHits.set(ip, existing)
  return false
}

async function sendWelcomeSms(buyerId: string, to: string) {
  const from = (await resolveFromNumber(buyerId)) || formatPhoneE164(process.env.DEFAULT_OUTBOUND_DID)
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!from || !messagingProfileId) return
  await fetch(`${TELNYX_API_URL}/messages`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      from,
      to,
      text: WELCOME_TEXT,
      messaging_profile_id: messagingProfileId,
      type: "SMS",
      use_profile_webhooks: true,
    }),
  })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest, event: NextFetchEvent) {
  const origin = request.headers.get("origin") || ""
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }

  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  if (isRateLimited(ip)) {
    return errorResponse(429, origin, "rate_limited", "Too many signup requests")
  }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error_code: "invalid_body", message: "Invalid request body", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders(origin) })
  }

  const payload = parsed.data
  if (!payload.consent_text || payload.consent_text.length < 50) {
    return errorResponse(400, origin, "missing_consent", "Consent text is required")
  }

  const phoneE164 = formatPhoneE164(payload.phone)
  if (!phoneE164 || !phoneE164.startsWith("+1") || phoneE164.length !== 12) {
    return errorResponse(400, origin, "invalid_phone", "Phone must be valid US E.164")
  }

  try {
    const emailNorm = normalizeEmail(payload.email)
    let query = supabaseAdmin.from("buyers").select("id,fname,lname,status,tags,can_receive_sms,is_unsubscribed").eq("phone_norm", phoneE164.replace(/^\+1/, ""))
    if (emailNorm) query = query.or(`phone_norm.eq.${phoneE164.replace(/^\+1/, "")},email_norm.eq.${emailNorm}`)
    const { data: existing } = await query.limit(1).maybeSingle()

    const mapped = BUYER_TYPE_MAPPING[payload.buyer_type]
    const tags = mergeUnique(mapped.tags, ["website-signup"])
    const common: Record<string, any> = {
      fname: payload.fname,
      lname: payload.lname || null,
      email: payload.email || null,
      phone: phoneE164,
      source: "website_signup",
      can_receive_sms: true,
      can_receive_email: true,
      is_unsubscribed: false,
      investor: mapped.investor,
      cash_buyer: mapped.cash_buyer,
      first_time_buyer: mapped.first_time_buyer,
      tags,
    }

    let buyerId = ""
    let isNewBuyer = false
    let sendSms = true

    if (existing?.id) {
      const updates: Record<string, any> = { ...common }
      if (!existing.status || existing.status === "unsubscribed") updates.status = "lead"
      const { data: updated, error: updateError } = await supabaseAdmin.from("buyers").update(updates).eq("id", existing.id).select("id,can_receive_sms,is_unsubscribed").single()
      if (updateError || !updated) throw updateError || new Error("Update failed")
      buyerId = updated.id
      sendSms = updated.can_receive_sms !== false && updated.is_unsubscribed !== true
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin.from("buyers").insert({ ...common, status: "lead" }).select("id,can_receive_sms,is_unsubscribed").single()
      if (insertError || !inserted) throw insertError || new Error("Insert failed")
      buyerId = inserted.id
      isNewBuyer = true
      sendSms = inserted.can_receive_sms !== false && inserted.is_unsubscribed !== true
    }

    await supabaseAdmin.from("buyer_consents").insert({
      buyer_id: buyerId,
      consent_text: payload.consent_text,
      source: "website_signup",
      source_url: payload.source_url || null,
      ip_address: ip,
      user_agent: request.headers.get("user-agent") || null,
    })

    if (sendSms) {
      event.waitUntil(sendWelcomeSms(buyerId, phoneE164))
    }

    return NextResponse.json({ ok: true, buyer_id: buyerId, is_new_buyer: isNewBuyer }, { headers: corsHeaders(origin) })
  } catch (error) {
    console.error("[public-buyers-signup] error", error)
    return errorResponse(500, origin, "internal_error", "Internal server error")
  }
}
