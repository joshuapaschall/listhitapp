import { NextRequest, NextResponse } from "next/server"
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

export async function POST(request: NextRequest) {
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
    const phoneNorm = phoneE164.replace(/^\+1/, "")

    const DEDUP_COLS =
      "id,org_id,fname,lname,status,tags,locations,property_type,investor,cash_buyer,owner_financing,first_time_buyer,can_receive_sms,is_unsubscribed"

    // Dedup MUST be matched at the SAME scope as the unique indexes on buyers.
    // buyers_email_norm_idx and buyers_phone_norm_idx are GLOBAL (cross-org)
    // unique indexes, so this lookup is intentionally NOT org-scoped. A lead is
    // a duplicate if it matches an existing row by phone_norm OR email_norm.
    // NOTE: if those indexes are ever migrated to org-scoped partial unique
    // indexes on (org_id, *), this lookup MUST add .eq("org_id", orgId).
    const orParts = [`phone_norm.eq.${phoneNorm}`]
    if (emailNorm) orParts.push(`email_norm.eq.${emailNorm}`)
    const orFilter = orParts.join(",")

    async function findExistingBuyer() {
      const { data, error } = await supabaseAdmin
        .from("buyers")
        .select(DEDUP_COLS)
        .or(orFilter)
        .limit(1)
        .maybeSingle()
      if (error) console.error("[public-buyers-signup] dedup lookup error", error)
      return data
    }

    const existing = await findExistingBuyer()

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

    // Merge-update an already-existing buyer row. IMPORTANT: never overwrite
    // org_id — a cross-org global-unique match must stay owned by its original
    // org rather than being reassigned to the current tenant.
    async function updateExistingBuyer(row: {
      id: string
      tags?: string[] | null
      locations?: string[] | null
      property_type?: string[] | null
      investor?: boolean | null
      cash_buyer?: boolean | null
      owner_financing?: boolean | null
      first_time_buyer?: boolean | null
    }) {
      const { org_id: _omitOrgId, ...commonNoOrg } = common
      const updates: Record<string, any> = {
        ...commonNoOrg,
        tags: mergeUnique(row.tags || [], common.tags || []) ?? [],
        locations: mergeUnique(row.locations || [], common.locations || []) ?? [],
        property_type: mergeUnique(row.property_type || [], common.property_type || []) ?? [],
        investor: Boolean(row.investor) || common.investor,
        cash_buyer: Boolean(row.cash_buyer) || common.cash_buyer,
        owner_financing: Boolean(row.owner_financing) || common.owner_financing,
        first_time_buyer: Boolean(row.first_time_buyer) || common.first_time_buyer,
      }
      const { data: updated, error } = await supabaseAdmin
        .from("buyers")
        .update(updates)
        .eq("id", row.id)
        .select("id,can_receive_sms,is_unsubscribed")
        .single()
      if (error || !updated) throw error || new Error("Update failed")
      buyerId = updated.id
      sendSms = updated.can_receive_sms !== false && updated.is_unsubscribed !== true
    }

    if (existing?.id) {
      await updateExistingBuyer(existing)
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("buyers")
        .insert(common)
        .select("id,can_receive_sms,is_unsubscribed")
        .single()
      if (error) {
        // 23505 = unique_violation. A duplicate the proactive dedup did not catch
        // (race, or matched on a column the OR did not cover) collided with a
        // GLOBAL unique index. Recover by re-looking-up and updating instead of
        // returning a 500.
        if ((error as any)?.code === "23505") {
          const dup = await findExistingBuyer()
          if (dup?.id) {
            await updateExistingBuyer(dup)
          } else {
            throw error
          }
        } else {
          throw error
        }
      } else if (!inserted) {
        throw new Error("Insert failed")
      } else {
        buyerId = inserted.id
        sendSms = inserted.can_receive_sms !== false && inserted.is_unsubscribed !== true
      }
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
    if (sendSms && !site) {
      // Awaited (not deferred): App Router route handlers have no waitUntil. A
      // Telnyx failure must never fail the signup, so it is fully guarded.
      try {
        await sendWelcomeSms(buyerId, phoneE164, welcomeMessage)
      } catch (smsError) {
        console.error("[public-buyers-signup] welcome sms failed", smsError)
      }
    }

    // First-party analytics: record a 'lead' event. Awaited (App Router route
    // handlers have no waitUntil); the body swallows its own errors so it never
    // throws and never fails the signup.
    if (orgId) {
      let leadPath: string | null = null
      try {
        if (payload.source_url) leadPath = new URL(payload.source_url).pathname
      } catch {
        /* ignore malformed source_url */
      }
      await (async () => {
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
      })()
    }

    return NextResponse.json({ ok: true, buyer_id: buyerId, is_new_buyer: isNewBuyer }, { headers: corsHeaders(origin) })
  } catch (error) {
    console.error("[public-buyers-signup] error", error)
    return errorResponse(500, origin, "internal_error", "Internal server error")
  }
}
