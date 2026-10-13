import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { getOrgTwilio, upsertOrgTwilio } from "@/lib/org-twilio/service"
import { readOrgId, requirePlatformAdmin } from "../_shared"

export const dynamic = "force-dynamic"

// Toggle mock registration (free mock brand/campaign; a real number is still
// bought so voice can be tested). Locked once a brand exists — mock and real
// registrations can't be mixed mid-flight.
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const parsed = await readOrgId(request)
  if (parsed instanceof NextResponse) return parsed
  if (typeof parsed.body?.mock !== "boolean") {
    return NextResponse.json({ ok: false, error: "mock (boolean) is required" }, { status: 400 })
  }

  try {
    const row = await getOrgTwilio(parsed.orgId)
    if (row?.brand_sid) {
      return NextResponse.json(
        { ok: false, error: "Mock mode can't change after the brand is registered." },
        { status: 409 },
      )
    }
    await upsertOrgTwilio(parsed.orgId, { mock_registration: parsed.body.mock })
    return NextResponse.json({ ok: true, mock: parsed.body.mock })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
