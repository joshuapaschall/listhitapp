import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { advanceRegistration } from "@/lib/org-twilio/engine"
import { readOrgId, requirePlatformAdmin } from "../_shared"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// Manual nudge: run the registration engine once for an org.
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const parsed = await readOrgId(request)
  if (parsed instanceof NextResponse) return parsed

  try {
    const result = await advanceRegistration(parsed.orgId, { reason: "admin" })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
