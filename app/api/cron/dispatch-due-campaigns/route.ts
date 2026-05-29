import { NextRequest, NextResponse } from "next/server"
import { assertCronAuth } from "@/lib/cron-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const maxDuration = 300
export const runtime = "nodejs"

const resolveTimezone = (tz: string | null | undefined) =>
  tz && tz.trim() ? tz : "America/New_York"
const getNowInTimezone = (tz: string) => {
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
  } catch (_err) {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var is required" }, { status: 500 })
  }

  const origin = request.nextUrl.origin

  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, weekday_only, run_from, run_until, scheduled_at, timezone")
    .lte("scheduled_at", new Date().toISOString())
    .eq("status", "pending")
    .not("scheduled_at", "is", null)

  if (error) {
    console.error("dispatch due campaigns failed to fetch campaigns", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }

  let dispatched = 0
  const errors: Array<{ campaignId: string; error: string }> = []

  for (const campaign of campaigns ?? []) {
    const timezone = resolveTimezone((campaign as any).timezone)
    const zonedNow = getNowInTimezone(timezone)

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

    const { error: markErr } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "processing" })
      .eq("id", campaign.id)

    if (markErr) {
      console.error("dispatch due campaigns could not mark processing", campaign.id, markErr)
      errors.push({ campaignId: campaign.id, error: markErr.message })
      continue
    }

    try {
      const resp = await fetch(`${origin}/api/campaigns/send`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ campaignId: campaign.id }),
      })

      if (!resp.ok) {
        const errorPayload = await resp.text()
        await supabaseAdmin
          .from("campaigns")
          .update({ status: "pending" })
          .eq("id", campaign.id)
        errors.push({
          campaignId: campaign.id,
          error: `Send route failed with ${resp.status}: ${errorPayload}`,
        })
        continue
      }

      dispatched += 1
    } catch (err: any) {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "pending" })
        .eq("id", campaign.id)
      errors.push({ campaignId: campaign.id, error: err?.message || String(err) })
    }
  }

  return NextResponse.json({ dispatched, errors })
}

export const GET = POST
