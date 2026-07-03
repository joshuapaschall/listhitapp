import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"

export const dynamic = "force-dynamic"

// Which voice engine should this org's browser dialer use? V1b calls this to pick
// between the Twilio Voice SDK and the existing Telnyx path.
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const row = await getOrgTwilio(orgId)
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
