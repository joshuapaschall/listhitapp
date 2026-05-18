// app/r/[slug]/route.ts
//
// Short link redirect endpoint. Hit by Next.js middleware after hostname-based
// rewrite of `<short-domain>/<slug>` → `/r/<slug>`.
//
// Runs on Edge runtime for fast global redirects (~50-100ms p99 target).

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "edge"
export const dynamic = "force-dynamic"

// Bot detection — matches common bots so click counts reflect humans only.
// IMPORTANT: bots still get the redirect (so link-preview unfurls work for Slack,
// Discord, Twitter, etc.). Only the click_count and clicked_at writes are skipped.
const BOT_UA_REGEX =
  /\b(bot|crawler|spider|crawling|curl|wget|HeadlessChrome|Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Applebot|AhrefsBot|SemrushBot|MJ12bot|MetaInspector|Embedly|Snapchat|Pinterest|redditbot|Iframely)\b/i

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Created once per Edge instance; reused across requests.
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export async function GET(
  request: NextRequest,
  context: { params: { slug: string } | Promise<{ slug: string }> },
) {
  if (!supabase) {
    console.error("[r/slug] Supabase env vars missing; redirect disabled")
    return new Response("Service unavailable", { status: 503 })
  }

  // Next 14/15 compat: params may or may not be a Promise.
  const params = await (context.params as Promise<{ slug: string }>)
  const slug = (params?.slug as string) || ""

  if (!slug) {
    return new Response("Not found", { status: 404 })
  }

  const host = (request.headers.get("host") || "")
    .toLowerCase()
    .split(":")[0]
  const userAgent = request.headers.get("user-agent") || ""

  // Lookup by (domain, slug). The composite unique index makes this a single B-tree seek.
  const { data: link, error } = await supabase
    .from("short_links")
    .select("id, target_url, expires_at")
    .eq("domain", host)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("[r/slug] lookup error:", error)
    return new Response("Lookup failed", { status: 500 })
  }

  if (!link) {
    return new Response("Link not found", { status: 404 })
  }

  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    return new Response("This link has expired", { status: 410 })
  }

  const isBot = BOT_UA_REGEX.test(userAgent)
  if (!isBot) {
    // Edge runtime terminates the worker immediately after the response is returned;
    // un-awaited promises are discarded. Await the RPC to guarantee the click is
    // recorded. The RPC is a single atomic UPDATE — typical latency 30-80ms.
    try {
      const { error: rpcErr } = await supabase.rpc("record_short_link_click", {
        p_link_id: link.id,
      })
      if (rpcErr) {
        console.error("[r/slug] click RPC failed:", rpcErr)
      }
    } catch (rpcThrown) {
      console.error("[r/slug] click RPC threw:", rpcThrown)
    }
  }

  return NextResponse.redirect(link.target_url as string, 302)
}
