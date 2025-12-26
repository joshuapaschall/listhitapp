import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verifyUnsubscribeSignature } from "@/lib/unsubscribe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function redirectToUnsubscribe(
  req: NextRequest,
  params: { done?: boolean; error?: string; email?: string },
) {
  const origin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
  const redirectUrl = new URL("/unsubscribe", origin)
  if (params.done) redirectUrl.searchParams.set("done", "1")
  if (params.error) redirectUrl.searchParams.set("error", params.error)
  if (params.email) redirectUrl.searchParams.set("e", params.email)
  return NextResponse.redirect(redirectUrl.toString(), { status: 302 })
}

async function parseParams(req: NextRequest, method: "GET" | "POST") {
  const searchParams = req.nextUrl.searchParams
  const form = method === "POST" ? await req.formData() : null
  const getValue = (key: string) => {
    const queryValue = searchParams.get(key)
    if (queryValue) return queryValue
    const formValue = form?.get(key)
    return formValue ? String(formValue) : ""
  }

  return {
    buyerId: getValue("id"),
    email: getValue("e"),
    campaignId: getValue("campaignId"),
    recipientId: getValue("recipientId"),
    timestamp: getValue("t"),
    signature: getValue("s"),
  }
}

async function handleUnsubscribe(req: NextRequest, method: "GET" | "POST") {
  const { buyerId, email, campaignId, recipientId, timestamp, signature } = await parseParams(req, method)

  if (!buyerId || !email || !timestamp || !signature) {
    return redirectToUnsubscribe(req, { error: "invalid", email })
  }

  const valid = verifyUnsubscribeSignature({
    buyerId,
    email,
    campaignId,
    recipientId,
    timestamp,
    signature,
  })

  if (!valid) {
    return redirectToUnsubscribe(req, { error: "invalid", email })
  }

  if (!supabaseAdmin) {
    return redirectToUnsubscribe(req, { error: "server", email })
  }

  const now = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from("buyers")
    .update({
      can_receive_email: false,
      email_suppressed: true,
      is_unsubscribed: true,
      unsubscribed_at: now,
    })
    .eq("id", buyerId)
    .eq("email", email)

  if (error) {
    console.error("Failed to suppress buyer", { buyerId, email, error })
    return redirectToUnsubscribe(req, { error: "server", email })
  }

  if (recipientId) {
    let query = supabaseAdmin.from("campaign_recipients").update({ unsubscribed_at: now }).eq("id", recipientId)
    if (campaignId) query = query.eq("campaign_id", campaignId)
    const { error: campaignError } = await query
    if (campaignError) {
      console.error("Failed to update campaign recipient unsubscribe", {
        campaignId,
        recipientId,
        error: campaignError,
      })
    }
  }

  const { error: eventError } = await supabaseAdmin.from("email_events").insert({
    event_type: "unsubscribe",
    campaign_id: campaignId || null,
    recipient_id: recipientId || null,
    buyer_id: buyerId,
    payload: {
      email,
      campaignId,
      recipientId,
      method,
      source: "unsubscribe-api",
    },
  })
  if (eventError) {
    console.error("Failed to insert unsubscribe email event", {
      buyerId,
      campaignId,
      recipientId,
      error: eventError,
    })
  }

  return redirectToUnsubscribe(req, { done: true, email })
}

export async function POST(req: NextRequest) {
  return handleUnsubscribe(req, "POST")
}

export async function GET(req: NextRequest) {
  return handleUnsubscribe(req, "GET")
}
