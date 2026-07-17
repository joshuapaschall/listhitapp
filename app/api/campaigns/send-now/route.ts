import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(request: NextRequest) {
  const { campaignId, expectedCount } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { user, orgId, supabase } = await requireOrgContext()

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!orgId) {
    return new Response(JSON.stringify({ error: "Organization context required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, channel")
    .eq("id", campaignId)
    .eq("org_id", orgId)
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

  if (campaign.channel === "sms") {
    const denied = await requirePermission(supabase, "campaigns.send_sms")
    if (denied) return denied
  }

  if (campaign.channel === "email") {
    const denied = await requirePermission(supabase, "campaigns.send_email")
    if (denied) return denied
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
      body: JSON.stringify({ campaignId, ...(typeof expectedCount === "number" ? { expectedCount } : {}) }),
      cache: "no-store",
      redirect: "manual",
    })

    const text = await res.text()
    const ok = res.ok ?? (res.status >= 200 && res.status < 300)
    const contentType = res.headers?.get?.("content-type") || ""

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return new Response(
        JSON.stringify({
          error: "Redirected",
          status: res.status,
          location: res.headers?.get?.("location"),
          body: text,
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      )
    }

    if (!ok) {
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

    // Forward the upstream body verbatim on success so the audience_count_mismatch
    // guard (a 200 carrying { paused, reason, resolved, expected }) reaches the client.
    let okBody: unknown = { ok: true }
    if (text.trim().length > 0 && contentType.includes("application/json")) {
      try {
        okBody = JSON.parse(text)
      } catch (err) {
        console.error("Failed to parse send response", err)
      }
    }
    return new Response(JSON.stringify(okBody), {
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
