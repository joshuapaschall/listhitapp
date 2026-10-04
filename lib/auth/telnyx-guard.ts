// Telnyx-only routes. The pinned org is the single tenant that runs on Telnyx;
// every other org is Twilio-only, so these endpoints must never reach the Telnyx
// API on their behalf. The message stays generic on purpose — a tenant has no
// business learning which provider another tenant uses.

import { NextResponse } from "next/server"

import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"

export function requireTelnyxPinnedOrg(orgId: string | null | undefined): NextResponse | null {
  if (isOrgTelnyxPinnedEnv(orgId)) return null
  return NextResponse.json({ error: "This feature isn't available for your account." }, { status: 403 })
}
