import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const { campaignId } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400 })
  }

  const baseUrl =
    process.env.DISPOTOOL_BASE_URL ||
    process.env.SITE_URL ||
    request.nextUrl.origin

  try {
    const auth =
      request.headers.get("authorization") ??
      `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`

    const res = await fetch(`${baseUrl}/api/campaigns/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
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

    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Send-now failed", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
  }
}
