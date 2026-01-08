import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST(request: NextRequest) {
  const { campaignId } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, user_id, created_by")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError) {
    console.error("Error fetching campaign for send-now:", campaignError)
    return new Response(JSON.stringify({ error: campaignError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (campaign.user_id !== user.id && campaign.created_by !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const baseUrl =
    process.env.DISPOTOOL_BASE_URL ||
    process.env.SITE_URL ||
    request.nextUrl.origin

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET env var is required to trigger campaigns" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    const res = await fetch(`${baseUrl}/api/campaigns/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({ campaignId }),
      cache: "no-store",
      redirect: "manual",
    })

    const text = await res.text()
    const contentType = res.headers.get("content-type") || ""

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return new Response(
        JSON.stringify({
          error: "Redirected",
          status: res.status,
          location: res.headers.get("location"),
          body: text,
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      )
    }

    if (!res.ok) {
      let body: any = null
      if (text.trim().length > 0 && contentType.includes("application/json")) {
        try {
          body = JSON.parse(text)
        } catch (err) {
          console.error("Failed to parse error response", err)
        }
      }
      const isMissingCampaign = body?.details?.includes("foreign key") || body?.hint?.includes("missing")
      return new Response(
        JSON.stringify({
          error: body?.error || "Failed to trigger campaign send",
          status: res.status,
          details: body?.details || (!body ? text : undefined),
          hint:
            body?.hint ||
            (isMissingCampaign
              ? "Campaign definition record is missing; ensure campaign_id is valid before queuing."
              : "Queue insertion failed; verify campaign definition exists and payload is valid."),
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Send-now failed", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
