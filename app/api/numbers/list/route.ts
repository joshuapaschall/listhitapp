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
  const items = await listPurchasedNumbersForOrigin();
  return NextResponse.json({ ok: true, items, defaultFrom: chooseDefault(items) });
}
