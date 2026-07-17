import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { resolveAudienceIds } from "@/lib/campaigns/resolve-audience-ids"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    let body: { channel?: unknown; buyerIds?: unknown; groupIds?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const channel = body.channel
    if (channel !== "email" && channel !== "sms") {
      return NextResponse.json({ error: "channel must be email or sms" }, { status: 400 })
    }

    const buyerIds = Array.isArray(body.buyerIds) ? body.buyerIds.filter((v): v is string => typeof v === "string") : []
    const groupIds = Array.isArray(body.groupIds) ? body.groupIds.filter((v): v is string => typeof v === "string") : []

    if (buyerIds.length === 0 && groupIds.length === 0) {
      return NextResponse.json({ count: 0, sampleIds: [] })
    }

    const ids = await resolveAudienceIds({ supabase, orgId, channel, buyerIds, groupIds })
    // sampleIds is capped at 3 and exists only to feed SmsPhonePreview — never
    // ship the full id array; that waste is the whole point of this endpoint.
    return NextResponse.json({ count: ids.length, sampleIds: ids.slice(0, 3) })
  } catch (err) {
    console.error("[audience-count] failed", err)
    return NextResponse.json({ error: "Failed to resolve audience" }, { status: 500 })
  }
}
