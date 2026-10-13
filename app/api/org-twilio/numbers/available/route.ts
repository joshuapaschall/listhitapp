import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { getParentAccountClient } from "@/lib/twilio/parent"
import { requireRegistrationContext } from "../../_shared"

export const dynamic = "force-dynamic"

const AREA_CODE_RE = /^\d{3}$/
const CONTAINS_RE = /^[0-9*]{2,16}$/

// Number search needs no subaccount: availability is the same for every account,
// so the parent client searches and the engine buys in the org's subaccount later.
export async function GET(request: Request) {
  const ctx = await requireRegistrationContext()
  if (ctx instanceof NextResponse) return ctx

  const params = new URL(request.url).searchParams
  let areaCode = (params.get("areaCode") ?? "").trim()
  const contains = (params.get("contains") ?? "").trim()

  if (!areaCode) {
    const { data: org } = await supabaseAdmin.from("organizations").select("phone").eq("id", ctx.orgId).maybeSingle()
    const e164 = formatPhoneE164((org as { phone?: string | null } | null)?.phone ?? "")
    areaCode = e164?.match(/^\+1(\d{3})\d{7}$/)?.[1] ?? ""
  }
  if (!AREA_CODE_RE.test(areaCode)) {
    return NextResponse.json({ error: "Enter a 3-digit area code." }, { status: 400 })
  }
  if (contains && !CONTAINS_RE.test(contains)) {
    return NextResponse.json({ error: "Search digits must be 2–16 numbers (use * as a wildcard)." }, { status: 400 })
  }

  try {
    const results = await getParentAccountClient()
      .availablePhoneNumbers("US")
      .local.list({
        areaCode: Number(areaCode),
        ...(contains ? { contains } : {}),
        smsEnabled: true,
        voiceEnabled: true,
        limit: 10,
      })
    return NextResponse.json(
      results.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendly: n.friendlyName,
        locality: n.locality ?? null,
        region: n.region ?? null,
      })),
    )
  } catch (err) {
    return apiError(err, 502, "Number search is unavailable right now. Try again.")
  }
}
