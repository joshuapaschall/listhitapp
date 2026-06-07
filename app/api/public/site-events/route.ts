import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ALLOWED_ORIGINS, corsHeaders, isRateLimited, originHost, isTenantSubdomainOrigin } from "@/lib/public-api"
import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { supabaseAdmin } from "@/lib/supabase/admin"

const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|slurp/i

const bodySchema = z.object({
  path: z.string().max(512).optional(),
  referrer: z.string().max(512).optional(),
  utm_source: z.string().max(128).optional(),
  utm_medium: z.string().max(128).optional(),
  utm_campaign: z.string().max(128).optional(),
  visitor_id: z.string().max(64).optional(),
})

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  if (!ALLOWED_ORIGINS.includes(origin) && !isTenantSubdomainOrigin(origin)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || ""

  // Allow only published builder sites (tenant subdomain / active custom domain)
  // or a statically-allowed origin. The pageview lands in the owning org.
  const isStatic = ALLOWED_ORIGINS.includes(origin)
  if (!isStatic && !isTenantSubdomainOrigin(origin)) {
    return new NextResponse(null, { status: 403, headers: corsHeaders(origin) })
  }

  const host = originHost(origin)
  const site = host ? await resolveSiteByHost(host).catch(() => null) : null
  if (!site && !isStatic) {
    return new NextResponse(null, { status: 403, headers: corsHeaders(origin) })
  }

  // Drop bots/crawlers/link-preview fetchers silently — don't pollute analytics.
  const ua = request.headers.get("user-agent") || ""
  if (BOT_UA.test(ua)) return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })

  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  if (isRateLimited(ip, "site-events", 60)) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  // Always respond 204 fast and never throw to the client.
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (parsed.success && site) {
      const b = parsed.data
      await supabaseAdmin.from("site_events").insert({
        site_id: site.id,
        org_id: site.org_id,
        type: "pageview",
        path: b.path ?? null,
        referrer: b.referrer ?? null,
        utm_source: b.utm_source ?? null,
        utm_medium: b.utm_medium ?? null,
        utm_campaign: b.utm_campaign ?? null,
        visitor_id: b.visitor_id ?? null,
      })
    }
  } catch {
    /* fire-and-forget: swallow all errors, the beacon never blocks the page */
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}
