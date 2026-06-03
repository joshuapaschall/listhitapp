export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";

// SMS-by-buyer timeline feed for the Edit Buyer modal's Communications tab.
// Auth/org guard copied verbatim from app/api/calls/history/route.ts.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, orgId, supabase } = await requireOrgContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 });

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("buyer_id", params.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      // Degrade gracefully — the timeline should never throw.
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
