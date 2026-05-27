import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOrgContext, validatePatchBody } from "../_shared";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { data: market, error } = await supabaseAdmin.from("markets").select("*").eq("org_id", orgId).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!market) return NextResponse.json({ ok: false, error: "Market not found" }, { status: 404 });
  const { count } = await supabaseAdmin.from("inbound_numbers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("market_id", params.id);
  return NextResponse.json({ ok: true, market: { ...market, numberCount: count ?? 0 } });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { update, error: validationError } = validatePatchBody(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  const { data: market, error } = await supabaseAdmin.from("markets").update(update).eq("org_id", orgId).eq("id", params.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const warning = (market?.call_routing_mode === "forwarding_only" || market?.call_routing_mode === "browser_first_then_forward") && !market?.call_forwarding_number ? "No forwarding number set" : undefined;
  return NextResponse.json(warning ? { ok: true, market, warning } : { ok: true, market });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { count } = await supabaseAdmin.from("inbound_numbers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("market_id", params.id);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "Move numbers out first", numberCount: count ?? 0 }, { status: 409 });
  const { error } = await supabaseAdmin.from("markets").delete().eq("org_id", orgId).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, market: null });
}
