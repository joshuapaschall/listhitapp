import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { getOnboardingState, upsertStepStatus } from "@/lib/onboarding/service"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ key: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const { key } = await context.params

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  try {
    const result = await upsertStepStatus(orgId, key, body?.status)
    if (!result.ok) return apiError(result.error, 400)
    const state = await getOnboardingState(orgId, user.id)
    return NextResponse.json(state)
  } catch (err) {
    return apiError(err, 500)
  }
}
