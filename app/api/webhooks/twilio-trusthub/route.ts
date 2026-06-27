import { NextRequest, NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase"

// Twilio TrustHub CustomerProfile status callback. Sessionless — uses
// supabaseAdmin only. We CANNOT verify X-Twilio-Signature (we authenticate the
// ISV account with an API key, not the account Auth Token), so the endpoint is
// guarded by a shared-secret query token registered on the CP at create time.
export const runtime = "nodejs"

function authorized(request: NextRequest): boolean {
  const expected =
    process.env.LISTHIT_TWILIO_STATUS_CALLBACK_TOKEN || process.env.CRON_SECRET || ""
  if (!expected) return false
  const token = request.nextUrl.searchParams.get("token")
  return token === expected
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Forbidden", { status: 403 })

  try {
    const form = await request.formData()
    const sid = String(form.get("Sid") || "")
    const status = String(form.get("Status") || "")

    if (!sid) return new NextResponse(null, { status: 204 })

    const { data: row } = await supabaseAdmin
      .from("org_twilio")
      .select("id, org_id")
      .eq("secondary_profile_sid", sid)
      .maybeSingle()

    // Unknown SID → 204 (idempotent, don't leak whether the resource exists).
    if (!row) return new NextResponse(null, { status: 204 })

    const update: Record<string, unknown> = {
      customer_profile_status: status || null,
      updated_at: new Date().toISOString(),
    }
    // CP rejection fails the pipeline; approval alone does NOT advance a2p_status.
    if (status === "twilio-rejected") update.a2p_status = "failed"

    await supabaseAdmin.from("org_twilio").update(update).eq("id", row.id)

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[twilio-trusthub webhook] failed", err)
    return new NextResponse(null, { status: 204 })
  }
}
