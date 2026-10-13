import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { loadRoutingState } from "@/lib/providers/routing-state"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"

export const dynamic = "force-dynamic"

// Which voice engine should this org's browser dialer use? "telnyx" (owner org
// only), "twilio", or "blocked" — a tenant whose voice isn't set up, which must
// not initialize any voice SDK.
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const row = await loadRoutingState(orgId)
    const provider = resolveVoiceProviderName(
      orgId,
      row,
      parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS),
    )
    return NextResponse.json({ provider })
  } catch (err) {
    return apiError(err, 500)
  }
}
