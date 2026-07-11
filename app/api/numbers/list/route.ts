import { NextResponse } from "next/server";

import { requireOrgContext } from "@/lib/auth/org-context";
import { getOrgTwilio } from "@/lib/org-twilio/service";
import {
  parseTelnyxPinnedOrgIds,
  resolveVoiceProviderName,
} from "@/lib/providers/voice/routing";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// Caller-ID options for the dialer. Authenticated + org-scoped: never expose the
// owner's account-wide Telnyx inventory to a tenant. Shape is drop-in for
// components/voice/Dialer.tsx: { ok, items: { e164, label? }[], defaultFrom }.
export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 });

  const row = await getOrgTwilio(orgId);
  const pinned = parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS);
  const provider = resolveVoiceProviderName(orgId, row, pinned);

  if (provider === "twilio") {
    // A Twilio-voice org's caller ID is server-enforced to its own Twilio number.
    // Never expose the owner's Telnyx inventory to a tenant.
    const e164 = row?.phone_number ?? null;
    const items = e164
      ? [{ e164, label: "Primary", verified: true, assignedToApp: true }]
      : [];
    return NextResponse.json({ ok: true, items, defaultFrom: e164 });
  }

  // Telnyx orgs: list only THIS org's numbers from the database (RLS + explicit
  // filter), not the account-wide Telnyx inventory.
  const inbound = await supabase
    .from("inbound_numbers")
    .select("e164")
    .eq("org_id", orgId)
    .eq("enabled", true);

  let items = (inbound.data ?? [])
    .map((r: { e164: string }) => r.e164)
    .filter(Boolean)
    .map((e164: string) => ({ e164 }));

  if (!items.length) {
    const voice = await supabase
      .from("voice_numbers")
      .select("phone_number")
      .eq("org_id", orgId);
    items = (voice.data ?? [])
      .map((r: { phone_number: string }) => r.phone_number)
      .filter(Boolean)
      .map((e164: string) => ({ e164 }));
  }

  return NextResponse.json({ ok: true, items, defaultFrom: items[0]?.e164 ?? null });
}
