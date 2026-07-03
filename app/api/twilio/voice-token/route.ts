import { NextResponse } from "next/server"
import twilio from "twilio"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

export const dynamic = "force-dynamic"

const TOKEN_TTL_SECONDS = 3600

// Mints a Twilio Voice Access Token (JWT) for the browser dialer. Any org member
// may dial. The token names our TwiML App via the VoiceGrant; incoming is allowed
// (V2) so the inbound webhook can ring this browser at its <Client> identity.
export async function POST() {
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
    if (provider !== "twilio") {
      return apiError("This organization is not on Twilio voice.", 409)
    }

    const accountSid = process.env.LISTHIT_TWILIO_ACCOUNT_SID
    const apiKeySid = process.env.LISTHIT_TWILIO_API_KEY_SID
    const apiKeySecret = process.env.LISTHIT_TWILIO_API_KEY_SECRET
    const twimlAppSid = process.env.LISTHIT_TWILIO_TWIML_APP_SID
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return apiError(
        "Twilio voice is not configured: set LISTHIT_TWILIO_ACCOUNT_SID, " +
          "LISTHIT_TWILIO_API_KEY_SID, LISTHIT_TWILIO_API_KEY_SECRET, and LISTHIT_TWILIO_TWIML_APP_SID.",
        500,
      )
    }

    const identity = buildVoiceIdentity(orgId, user.id)

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: TOKEN_TTL_SECONDS,
    })
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: true }))

    return NextResponse.json({ token: token.toJwt(), identity, ttl: TOKEN_TTL_SECONDS })
  } catch (err) {
    return apiError(err, 500)
  }
}
