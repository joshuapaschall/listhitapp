import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { getSmsReadiness } from "@/lib/providers/sms"

export const dynamic = "force-dynamic"

// Returns the org's SMS provider name so client-side pricing can pick the right
// rate: "telnyx" (owner org only), "twilio", or "blocked" when a tenant's texting
// isn't set up. Uses the same routing decision as send time; never throws.
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user || !orgId) return NextResponse.json({ provider: "blocked" })
  return NextResponse.json({ provider: await getSmsReadiness(orgId) })
}
