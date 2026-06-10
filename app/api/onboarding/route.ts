import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { getOnboardingState } from "@/lib/onboarding/service"

export const dynamic = "force-dynamic"

export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const state = await getOnboardingState(orgId, user.id)
    return NextResponse.json(state)
  } catch (err) {
    return apiError(err, 500)
  }
}
