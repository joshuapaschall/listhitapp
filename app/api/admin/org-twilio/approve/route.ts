import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { advanceRegistration } from "@/lib/org-twilio/engine"
import { getOrgTwilio, upsertOrgTwilio } from "@/lib/org-twilio/service"
import { buildRegistrationStatus } from "@/lib/org-twilio/status"
import { readOrgId, requirePlatformAdmin } from "../_shared"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// Approve spend for an org: from here the engine may buy its number and file
// its brand and campaign.
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const parsed = await readOrgId(request)
  if (parsed instanceof NextResponse) return parsed

  try {
    const row = await getOrgTwilio(parsed.orgId)
    if (!row) return NextResponse.json({ ok: false, error: "No registration for that org" }, { status: 404 })
    if (!row.spend_approved_at) {
      await upsertOrgTwilio(parsed.orgId, {
        spend_approved_at: new Date().toISOString(),
        spend_approved_by: admin.userId,
      })
    }
    const result = await advanceRegistration(parsed.orgId, { reason: "approved" })
    return NextResponse.json({ ok: true, ...result, status: buildRegistrationStatus(await getOrgTwilio(parsed.orgId)) })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
