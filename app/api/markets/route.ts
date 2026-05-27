import { NextResponse } from "next/server";
import { requireOrgContext } from "./_shared";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Missing org" }, { status: 400 });

  const { data: markets, error } = await supabaseAdmin.from("markets").select("*").eq("org_id", orgId).order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (markets ?? []).map((m) => m.id);
  const { data: numbers } = ids.length
    ? await supabaseAdmin.from("inbound_numbers").select("market_id").eq("org_id", orgId).in("market_id", ids)
    : { data: [] as { market_id: string | null }[] };

  const counts = (numbers ?? []).reduce<Record<string, number>>((acc, n) => {
    if (n.market_id) acc[n.market_id] = (acc[n.market_id] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ ok: true, markets: (markets ?? []).map((m) => ({ ...m, numberCount: counts[m.id] ?? 0 })) });
}

export async function POST(request: Request) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Missing org" }, { status: 400 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const purpose = body.purpose === "main" ? "main" : body.purpose === "campaign" ? "campaign" : null;
  if (!name || !purpose) return NextResponse.json({ ok: false, error: "Invalid name or purpose" }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("markets").select("id").eq("org_id", orgId).ilike("name", name).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "Market name already exists" }, { status: 409 });

  const { data: market, error } = await supabaseAdmin.from("markets").insert({ org_id: orgId, name, purpose }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, market });
}
