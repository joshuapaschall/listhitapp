import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { OtpRateLimitedError, resendSoleProprietorOtp } from "@/lib/org-twilio/engine"
import { requireRegistrationContext, statusResponse } from "../../_shared"

export const dynamic = "force-dynamic"

export async function POST() {
  const ctx = await requireRegistrationContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    await resendSoleProprietorOtp(ctx.orgId)
    return await statusResponse(ctx.orgId)
  } catch (err) {
    if (err instanceof OtpRateLimitedError) {
      return NextResponse.json({ error: err.message, code: "otp_rate_limited" }, { status: 429 })
    }
    return apiError(err, 500)
  }
}
