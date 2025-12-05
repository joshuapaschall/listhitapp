// supabase/functions/send-scheduled-campaigns/index.ts
// -----------------------------------------------
// Invoked by pg_cron every 5 min (or 1 min while testing)
// Finds pending campaigns, marks them “processing”,
// then asks your Next.js API route to deliver them.
//
// Deploy with: supabase functions deploy send-scheduled-campaigns
// (do NOT paste this file into the SQL editor).
//
// IMPORTANT:
// • SUPABASE_URL  and SUPABASE_SERVICE_ROLE_KEY must be
//   present in Supabase Secrets.
// • DISPOTOOL_BASE_URL (or SITE_URL) must point at the
//   deployment that hosts /api/campaigns/send
// -----------------------------------------------

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  /* 1️⃣  Load secrets AFTER the function starts */
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const BASE_URL =
    Deno.env.get("DISPOTOOL_BASE_URL") ??
    Deno.env.get("SITE_URL")           ?? ""

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
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, weekday_only, run_from, run_until")
    .lte("scheduled_at", new Date().toISOString())
    .eq("status", "pending")

  if (error) {
    console.error("Error fetching campaigns", error)
    return new Response("error", { status: 500 })
  }

  console.log("🚀 Found", (campaigns ?? []).length, "pending campaigns")

  /* 5️⃣  Process each campaign */
  for (const campaign of campaigns ?? []) {
    console.log("→ Processing", campaign.id)

    const estNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    )
    if (
      campaign.weekday_only &&
      (estNow.getDay() === 0 || estNow.getDay() === 6)
    ) {
      continue
    }
    if (campaign.run_from && campaign.run_until) {
      const [fh, fm] = campaign.run_from.split(":").map(Number)
      const [th, tm] = campaign.run_until.split(":").map(Number)
      const nowMin = estNow.getHours() * 60 + estNow.getMinutes()
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,   // ← key added here
      },
      body: JSON.stringify({ campaignId: campaign.id }),
    })

    if (!resp.ok) {
      console.error("❌ Send failed", campaign.id, await resp.text())
      await supabase
        .from("campaigns")
        .update({ status: "pending" })
        .eq("id", campaign.id)
    } else {
      console.log("✅ Sent", campaign.id)
    }
  }

  /* 6️⃣  Kick email queue dispatcher if pending jobs exist */
  const { count: pendingEmails, error: queueErr } = await supabase
    .from("email_campaign_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())

  if (queueErr) {
    console.error("Error checking email queue", queueErr)
    return new Response("error", { status: 500 })
  }

  if ((pendingEmails ?? 0) > 0) {
    console.log("📧 Dispatching", pendingEmails, "email queue jobs")
    const resp = await fetch(`${BASE_URL}/api/email-queue/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    })

    if (!resp.ok) {
      console.error("❌ Email queue dispatch failed", await resp.text())
      return new Response("error", { status: 500 })
    }
  } else {
    console.log("📭 No pending email queue jobs")
  }

  return new Response("ok", { status: 200 })
})
