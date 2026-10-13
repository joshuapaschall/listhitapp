import { NextResponse } from "next/server"
import twilio from "twilio"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { loadRoutingState } from "@/lib/providers/routing-state"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"
import { getOrgCredentials } from "@/lib/twilio/credentials"

export const dynamic = "force-dynamic"

const TOKEN_TTL_SECONDS = 3600

// Mints a Twilio Voice Access Token (JWT) for the browser dialer. Any org member
// may dial. The token is signed with the org's OWN subaccount API key, carries
// the subaccount SID, and names the TwiML App inside that subaccount; incoming
// is allowed so the inbound webhook can ring this browser at its <Client> identity.
export async function POST() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const state = await loadRoutingState(orgId)
    const provider = resolveVoiceProviderName(
      orgId,
      state,
      parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS),
    )
    if (provider === "blocked") {
      return NextResponse.json(
        { error: "Calling isn't set up for your account yet.", code: "voice_not_ready" },
        { status: 409 },
      )
    }
    if (provider !== "twilio") {
      return apiError("This organization is not on Twilio voice.", 409)
    }

    const creds = await getOrgCredentials(orgId)
    if (!creds?.apiKeySid || !creds.apiKeySecret || !creds.twimlAppSid) {
      return NextResponse.json(
        { error: "Calling isn't set up for your account yet.", code: "voice_not_ready" },
        { status: 409 },
      )
    }

    const identity = buildVoiceIdentity(orgId, user.id)

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    const token = new AccessToken(creds.subaccountSid, creds.apiKeySid, creds.apiKeySecret, {
      identity,
      ttl: TOKEN_TTL_SECONDS,
    })
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: creds.twimlAppSid, incomingAllow: true }))

    return NextResponse.json({ token: token.toJwt(), identity, ttl: TOKEN_TTL_SECONDS })
  } catch (err) {
    return apiError(err, 500)
  }
}
