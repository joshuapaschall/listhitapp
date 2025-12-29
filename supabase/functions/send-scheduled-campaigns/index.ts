// supabase/functions/send-scheduled-campaigns/index.ts
// -----------------------------------------------
// Invoked by pg_cron every 5 min (or 1 min while testing)
// Finds pending campaigns, marks them “processing”,
// then asks your Next.js API route to deliver them.
//
// IMPORTANT:
// • SUPABASE_URL  and SUPABASE_SERVICE_ROLE_KEY must be
//   present in Supabase Secrets.
// • DISPOTOOL_BASE_URL (or SITE_URL) must point at the
//   deployment that hosts /api/campaigns/send
// -----------------------------------------------

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req: Request) => {
  /* 1️⃣  Load secrets AFTER the function starts */
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const CRON_SECRET = Deno.env.get("CRON_SECRET")
  const BASE_URL =
    Deno.env.get("DISPOTOOL_BASE_URL") ?? Deno.env.get("SITE_URL") ?? ""

  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (!CRON_SECRET) {
    console.error("Missing CRON_SECRET")
    return new Response("Env vars missing", { status: 500 })
  }

  if (!token || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  /* 2️⃣  Guard-rail: bail if secrets missing */
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing env vars", { SUPABASE_URL, SERVICE_KEY })
    return new Response("Env vars missing", { status: 500 })
  }

  /* 3️⃣  Ensure BASE_URL exists */
  if (!BASE_URL) {
    console.error("Missing BASE_URL")
    return new Response("Base URL missing", { status: 500 })
  }

  /* 4️⃣  Create client only after secrets confirmed */
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  /* 5️⃣  Fetch pending campaigns */
  const { count: scheduledPendingCount, error: scheduledCountErr } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("scheduled_at", "is", null)

  if (scheduledCountErr) {
    console.error("Error counting scheduled campaigns", scheduledCountErr)
  } else {
    console.log("📅 Pending scheduled campaigns", scheduledPendingCount ?? 0)
  }

  const { count: dueCount, error: dueCountErr } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .lte("scheduled_at", new Date().toISOString())
    .eq("status", "pending")
    .not("scheduled_at", "is", null)

  if (dueCountErr) {
    console.error("Error counting due campaigns", dueCountErr)
  } else {
    console.log("⏰ Due campaigns", dueCount ?? 0)
  }

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, weekday_only, run_from, run_until, scheduled_at, timezone")
    .lte("scheduled_at", new Date().toISOString())
    .eq("status", "pending")
    .not("scheduled_at", "is", null)

  if (error) {
    console.error("Error fetching campaigns", error)
    return new Response("error", { status: 500 })
  }

  console.log("🚀 Found", (campaigns ?? []).length, "pending campaigns")

  const resolveTimezone = (tz: string | null | undefined) =>
    tz && tz.trim() ? tz : "America/New_York"
  const getNowInTimezone = (tz: string) => {
    try {
      return new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
    } catch (_err) {
      return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
    }
  }

  /* 5️⃣  Process each campaign */
  for (const campaign of campaigns ?? []) {
    const timezone = resolveTimezone((campaign as any).timezone)
    const zonedNow = getNowInTimezone(timezone)

    console.log("→ Processing", {
      BASE_URL,
      campaignId: campaign.id,
      scheduledAt: (campaign as any).scheduled_at,
      nowIso: new Date().toISOString(),
      timezone,
    })

    if (
      campaign.weekday_only &&
      (zonedNow.getDay() === 0 || zonedNow.getDay() === 6)
    ) {
      continue
    }
    if (campaign.run_from && campaign.run_until) {
      const [fh, fm] = campaign.run_from.split(":").map(Number)
      const [th, tm] = campaign.run_until.split(":").map(Number)
      const nowMin = zonedNow.getHours() * 60 + zonedNow.getMinutes()
      const fromMin = fh * 60 + fm
      const toMin = th * 60 + tm
      if (nowMin < fromMin || nowMin > toMin) {
        continue
      }
    }

    /* mark “processing” so no other run grabs it */
    const { error: markErr } = await supabase
      .from("campaigns")
      .update({ status: "processing" })
      .eq("id", campaign.id)

    if (markErr) {
      console.error("❌ Could not mark processing", campaign.id, markErr)
      continue
    }

    /* call the Next.js route with auth header */
    const resp = await fetch(`${BASE_URL}/api/campaigns/send`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ campaignId: campaign.id }),
    })

    const isRedirect = resp.status >= 300 && resp.status < 400

    if (isRedirect || !resp.ok) {
      const errorPayload = await resp.text()
      if (isRedirect) {
        console.error("❌ Send failed (redirect)", {
          campaignId: campaign.id,
          status: resp.status,
          location: resp.headers.get("location"),
        })
      } else {
        console.error("❌ Send failed", campaign.id, errorPayload)
      }
      await supabase
        .from("campaigns")
        .update({ status: "pending" })
        .eq("id", campaign.id)
    } else {
      console.log("✅ Sent", campaign.id)
    }
  }

  return new Response("ok", { status: 200 })
})
