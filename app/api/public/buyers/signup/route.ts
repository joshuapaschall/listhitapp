import { NextFetchEvent, NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { deriveProfile, personaBaseTags, type BuyerTypeKey, type PaymentKey, sanitizeLocations, sanitizePropertyTypes } from "@/lib/buyer-taxonomy"
import { normalizeEmail, formatPhoneE164, normalizePhone, mergeUnique } from "@/lib/dedup-utils"
import { validateEmailDebounce, isEmailAcceptable, WRITE_DIAGNOSTIC_TAGS } from "@/lib/debounce"
import { lookupNumber, isLineAcceptable } from "@/lib/number-lookup"
import { ALLOWED_ORIGINS, corsHeaders, errorResponse, isRateLimited, originHost, isTenantSubdomainOrigin } from "@/lib/public-api"
import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { resolveFromNumber } from "@/lib/showing-notifications"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

const WELCOME_TEXT = "Welcome to Georgia Wholesale Homes. We'll text you off-market deals — investment properties at 30-50% under retail. Reply STOP to opt out. HELP for info."

function welcomeText(brand: string) {
  return `Welcome to ${brand}. We'll text you off-market deals before they hit the market. Reply STOP to opt out, HELP for info.`
}

const bodySchema = z.object({
  fname: z.string().trim().min(1).max(50),
  lname: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email(),
  phone: z.string().min(1),
  buyer_type: z.enum(["fix_flip", "buy_hold", "first_time", "developer", "wholesaler", "realtor"]).optional(),
  buyer_types: z.array(z.enum(["fix_flip", "buy_hold", "first_time", "developer", "wholesaler", "realtor"])).max(6).optional(),
  payment_methods: z.array(z.enum(["cash", "hard_money", "creative_finance"])).max(3).optional(),
  property_types: z.array(z.string()).max(10).optional(),
  locations: z.array(z.string()).max(60).optional(),
  asking_price_min: z.number().nonnegative().optional(),
  asking_price_max: z.number().nonnegative().optional(),
  consent_text: z.string().min(50),
  marketing_consent: z.boolean().optional(),
  nonmarketing_consent: z.boolean().optional(),
  source_url: z.string().url().optional(),
  utm: z.record(z.string()).optional(),
})

async function sendWelcomeSms(buyerId: string, to: string, text: string) {
  const from = (await resolveFromNumber(buyerId)) || formatPhoneE164(process.env.DEFAULT_OUTBOUND_DID)
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!from || !messagingProfileId) return
  await fetch(`${TELNYX_API_URL}/messages`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({ from, to, text, messaging_profile_id: messagingProfileId, type: "SMS", use_profile_webhooks: true }),
  })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  if (!ALLOWED_ORIGINS.includes(origin) && !isTenantSubdomainOrigin(origin)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest, event: NextFetchEvent) {
  const origin = request.headers.get("origin") || ""
  const host = originHost(origin)
  const site = host ? await resolveSiteByHost(host) : null

  // A request is allowed if it comes from a published builder site (tenant
  // subdomain or active custom domain) OR a statically-allowed origin (the
  // legacy GWH site + localhost). The lead lands in the org that owns the origin.
  const isStatic = ALLOWED_ORIGINS.includes(origin)
  if (!site && !isStatic) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  const orgId: string | null = site?.org_id ?? (process.env.PUBLIC_SIGNUP_DEFAULT_ORG_ID || null)
  const brandName: string = site?.name || "our team"

  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  if (isRateLimited(ip, "buyers-signup", 5)) return errorResponse(429, origin, "rate_limited", "Too many signup requests")

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ ok: false, error_code: "invalid_body", message: "Invalid request body", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders(origin) })

  const payload = parsed.data
  const buyerTypes = payload.buyer_types || (payload.buyer_type ? [payload.buyer_type] : [])
  const phoneE164 = formatPhoneE164(payload.phone)
  if (!phoneE164 || !phoneE164.startsWith("+1") || phoneE164.length !== 12) return errorResponse(400, origin, "invalid_phone", "Phone must be valid US E.164")

  try {
    const emailNorm = normalizeEmail(payload.email)
    let query = supabaseAdmin.from("buyers").select("id,fname,lname,status,tags,locations,property_type,investor,cash_buyer,owner_financing,first_time_buyer,can_receive_sms,is_unsubscribed").eq("phone_norm", phoneE164.replace(/^\+1/, ""))
    if (emailNorm) query = query.or(`phone_norm.eq.${phoneE164.replace(/^\+1/, "")},email_norm.eq.${emailNorm}`)
    if (orgId) query = query.eq("org_id", orgId)
    const { data: existing } = await query.limit(1).maybeSingle()

    const isNewBuyer = !existing?.id
    if (isNewBuyer) {
      const line = isLineAcceptable(await lookupNumber(phoneE164))
      if (!line.accept) return errorResponse(400, origin, line.code, "Phone line type is not allowed")

      const emailVerdict = await validateEmailDebounce(payload.email)
      const emailDecision = isEmailAcceptable(emailVerdict)
      if (!emailDecision.accept) return errorResponse(400, origin, "invalid_email", "Email is invalid", { did_you_mean: emailVerdict.didYouMean })
      if (!WRITE_DIAGNOSTIC_TAGS && emailDecision.tag) console.warn("[public-buyers-signup] email diagnostic", emailVerdict.raw)
    }

    const derived = deriveProfile(buyerTypes as BuyerTypeKey[], (payload.payment_methods || []) as PaymentKey[])
    // Persona base tags come from the server-trusted site persona, never a
    // client value.
    const baseTags = personaBaseTags(site?.persona)
    const common: Record<string, any> = {
      fname: payload.fname,
      lname: payload.lname || null,
      email: payload.email,
      phone: normalizePhone(payload.phone),
      source: "website_signup",
      status: "lead",
      can_receive_sms: true,
      can_receive_email: true,
      is_unsubscribed: false,
      asking_price_min: payload.asking_price_min ?? null,
      asking_price_max: payload.asking_price_max ?? null,
      tags: mergeUnique(derived.tags, baseTags) ?? derived.tags,
      locations: sanitizeLocations(payload.locations),
      property_type: sanitizePropertyTypes(payload.property_types),
      investor: derived.investor,
      cash_buyer: derived.cash_buyer,
      owner_financing: derived.owner_financing,
      first_time_buyer: derived.first_time_buyer,
    }
    if (orgId) common.org_id = orgId

    let buyerId = ""
    let sendSms = true
    if (existing?.id) {
      const updates: Record<string, any> = {
        ...common,
        tags: mergeUnique(existing.tags || [], common.tags || []) ?? [],
        locations: mergeUnique(existing.locations || [], common.locations || []) ?? [],
        property_type: mergeUnique(existing.property_type || [], common.property_type || []) ?? [],
        investor: Boolean(existing.investor) || common.investor,
        cash_buyer: Boolean(existing.cash_buyer) || common.cash_buyer,
        owner_financing: Boolean(existing.owner_financing) || common.owner_financing,
        first_time_buyer: Boolean(existing.first_time_buyer) || common.first_time_buyer,
      }
      const { data: updated, error } = await supabaseAdmin.from("buyers").update(updates).eq("id", existing.id).select("id,can_receive_sms,is_unsubscribed").single()
      if (error || !updated) throw error || new Error("Update failed")
      buyerId = updated.id
      sendSms = updated.can_receive_sms !== false && updated.is_unsubscribed !== true
    } else {
      const { data: inserted, error } = await supabaseAdmin.from("buyers").insert(common).select("id,can_receive_sms,is_unsubscribed").single()
      if (error || !inserted) throw error || new Error("Insert failed")
      buyerId = inserted.id
      sendSms = inserted.can_receive_sms !== false && inserted.is_unsubscribed !== true
    }

    await supabaseAdmin.from("buyer_consents").insert({
      buyer_id: buyerId,
      consent_text: payload.consent_text,
      marketing_consent: payload.marketing_consent ?? false,
      nonmarketing_consent: payload.nonmarketing_consent ?? false,
      source: "website_signup",
      source_url: payload.source_url || null,
      ip_address: ip,
      user_agent: request.headers.get("user-agent") || null,
      ...(orgId ? { org_id: orgId } : {}),
    })

    // resolveFromNumber() is NOT org-scoped: for a brand-new lead it falls back
    // to the global DEFAULT_OUTBOUND_DID (the legacy/platform number). Texting a
    // tenant lead from that number would cross orgs, so we only auto-send the
    // welcome SMS on the legacy/static path (no resolved builder site). Tenant
    // welcome SMS will be enabled once sending is org-scoped (later phase).
    const welcomeMessage = site ? welcomeText(brandName) : WELCOME_TEXT
    if (sendSms && !site) event.waitUntil(sendWelcomeSms(buyerId, phoneE164, welcomeMessage))

    // First-party analytics: record a 'lead' event. Fire-and-forget via
    // waitUntil so it never delays the response, and never throws.
    if (orgId) {
      let leadPath: string | null = null
      try {
        if (payload.source_url) leadPath = new URL(payload.source_url).pathname
      } catch {
        /* ignore malformed source_url */
      }
      event.waitUntil(
        (async () => {
          try {
            await supabaseAdmin.from("site_events").insert({
              site_id: site?.id ?? null,
              org_id: orgId,
              type: "lead",
              path: leadPath,
              referrer: null,
              utm_source: payload.utm?.utm_source ?? null,
              utm_medium: payload.utm?.utm_medium ?? null,
              utm_campaign: payload.utm?.utm_campaign ?? null,
              visitor_id: null,
            })
          } catch {
            /* never throw from analytics */
          }
        })(),
      )
    }

    return NextResponse.json({ ok: true, buyer_id: buyerId, is_new_buyer: isNewBuyer }, { headers: corsHeaders(origin) })
  } catch (error) {
    console.error("[public-buyers-signup] error", error)
    return errorResponse(500, origin, "internal_error", "Internal server error")
  }
}
