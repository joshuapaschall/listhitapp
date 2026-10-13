import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { resubmitRegistration } from "@/lib/org-twilio/engine"
import { requireRegistrationContext, statusResponse } from "../_shared"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST() {
  const ctx = await requireRegistrationContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    await resubmitRegistration(ctx.orgId)
    return await statusResponse(ctx.orgId)
  } catch (err) {
    return apiError(err, 500)
  }
}
