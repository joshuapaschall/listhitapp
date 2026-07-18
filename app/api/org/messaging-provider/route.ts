import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { resolveSmsProvider } from "@/lib/providers/sms"

export const dynamic = "force-dynamic"

// Returns the org's SMS provider name so client-side pricing can pick the right
// rate. Uses the same resolver as send-time routing (SmsProvider.name is
// "telnyx" or "twilio"). Fails closed to "telnyx".
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user || !orgId) return NextResponse.json({ provider: "telnyx" })
  try {
    const provider = await resolveSmsProvider(orgId)
    const name = provider?.name === "twilio" ? "twilio" : "telnyx"
    return NextResponse.json({ provider: name })
  } catch {
    return NextResponse.json({ provider: "telnyx" })
  }
}
