import { NextResponse } from "next/server";

import { getFromNumberStatus } from "@/lib/telnyx/numbers";
import { getCallControlAppId, getSipCredentialConnectionId } from "@/lib/voice-env";

const sanitizeNumber = (value: string) => {
  const trimmed = (value || "").replace(/[^\d+]/g, "");
  if (!/^\+?[1-9]\d{6,15}$/.test(trimmed)) {
    return "";
  }
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const inputParam = url.searchParams.get("n") || "";
  const normalized = sanitizeNumber(inputParam);
  const appId = getCallControlAppId();
  const sipId = getSipCredentialConnectionId();

  if (!normalized || (!appId && !sipId)) {
    return NextResponse.json(
      { ok: false, error: "Missing n or voice identifiers" },
      { status: 400 },
    );
  }

  const status = await getFromNumberStatus(normalized);

  return NextResponse.json({
    ok: true,
    input: status.input,
    purchased_found: status.purchasedFound,
    assigned_to_app: status.assignedToApp,
    assigned_to_sip: status.assignedToSip,
    assigned_to_origin: status.assignedToOrigin,
    verified_caller_id: status.verifiedCallerId,
  });
}
