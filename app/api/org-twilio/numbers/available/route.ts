import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { searchLocalNumbers } from "@/lib/org-twilio/number-search"
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

  // The org's phone/ZIP/state widen the search when the area code has nothing.
  const { data: org } = await supabaseAdmin.from("organizations").select("phone, zip, state").eq("id", ctx.orgId).maybeSingle()
  const orgRow = (org ?? {}) as { phone?: string | null; zip?: string | null; state?: string | null }
  const orgPhone = formatPhoneE164(orgRow.phone ?? "")
  if (!areaCode) areaCode = orgPhone?.match(/^\+1(\d{3})\d{7}$/)?.[1] ?? ""
  if (!AREA_CODE_RE.test(areaCode)) {
    return NextResponse.json({ error: "Enter a 3-digit area code." }, { status: 400 })
  }
  if (contains && !CONTAINS_RE.test(contains)) {
    return NextResponse.json({ error: "Search digits must be 2–16 numbers (use * as a wildcard)." }, { status: 400 })
  }

  try {
    const { results, matchedBy } = await searchLocalNumbers(getParentAccountClient(), {
      areaCode,
      contains,
      nearPhone: orgPhone,
      postalCode: orgRow.zip ?? null,
      state: orgRow.state ?? null,
      limit: 10,
    })
    return NextResponse.json({
      results: results.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendly: n.friendlyName ?? null,
        locality: n.locality ?? null,
        region: n.region ?? null,
      })),
      matchedBy,
      searchedAreaCode: areaCode,
    })
  } catch (err) {
    return apiError(err, 502, "Number search is unavailable right now. Try again.")
  }
}
