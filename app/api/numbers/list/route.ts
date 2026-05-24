import { NextResponse } from "next/server";

import { listPurchasedNumbersForOrigin } from "@/lib/telnyx/numbers";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function chooseDefault(items: any[]) {
  return (
    items.find((i) => i.assignedToApp)?.e164 ||
    items.find((i) => i.verified)?.e164 ||
    null
  );
}

export async function GET() {
  const all = await listPurchasedNumbersForOrigin();
  // Only numbers assigned to the Voice API App can be used as caller ID for
  // outbound calls, so show just those in the dialer. Fall back to the full list
  // if none are app-assigned (avoids regressing to an empty dropdown).
  const appAssigned = all.filter((i) => i.assignedToApp);
  const items = appAssigned.length > 0 ? appAssigned : all;
  return NextResponse.json({ ok: true, items, defaultFrom: chooseDefault(items) });
}
