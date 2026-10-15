import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { getSetupSummary } from "@/lib/onboarding/outcomes"

export const dynamic = "force-dynamic"

// The setup hub's outcomes (business, website, texting, email + buyers), all
// derived from real data.
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    return NextResponse.json(await getSetupSummary(orgId, user.id))
  } catch (err) {
    return apiError(err, 500)
  }
}
