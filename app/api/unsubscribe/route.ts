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

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const buyerId = String(form.get("id") || "")
  const email = String(form.get("e") || "")
  const timestamp = String(form.get("t") || "")
  const signature = String(form.get("s") || "")

  if (!buyerId || !email || !timestamp || !signature) {
    return redirectToUnsubscribe(req, { error: "invalid", email })
  }

  const valid = verifyUnsubscribeSignature({
    buyerId,
    email,
    timestamp,
    signature,
  })

  if (!valid) {
    return redirectToUnsubscribe(req, { error: "invalid", email })
  }

  if (!supabaseAdmin) {
    return redirectToUnsubscribe(req, { error: "server", email })
  }

  const { error } = await supabaseAdmin
    .from("buyers")
    .update({ can_receive_email: false, email_suppressed: true })
    .eq("id", buyerId)
    .eq("email", email)

  if (error) {
    console.error("Failed to suppress buyer", { buyerId, email, error })
    return redirectToUnsubscribe(req, { error: "server", email })
  }

  return redirectToUnsubscribe(req, { done: true, email })
}
