import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { requireRegistrationContext, statusResponse } from "../_shared"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await requireRegistrationContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return await statusResponse(ctx.orgId)
  } catch (err) {
    return apiError(err, 500)
  }
}
