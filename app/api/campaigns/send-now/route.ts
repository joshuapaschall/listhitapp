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
    const res = await fetch(`${baseUrl}/api/campaigns/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
      },
      body: JSON.stringify({ campaignId }),
      cache: "no-store",
    })

    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Send-now failed", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
  }
}
