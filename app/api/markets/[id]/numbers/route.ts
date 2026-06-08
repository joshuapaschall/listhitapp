import { apiError } from "@/lib/api-error"
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/server";
import { requireOrgContext } from "../../_shared";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.markets");
  if (denied) return denied;
  const { data, error } = await supabase
    .from("inbound_numbers")
    .select("e164, label, enabled, config_override, voicemail_greeting_url, voicemail_greeting_source, call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds")
    .eq("org_id", orgId)
    .eq("market_id", params.id)
    .order("label");
  if (error) return apiError(error, 500, undefined, { ok: false });
  return NextResponse.json({ ok: true, numbers: data ?? [] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.markets");
  if (denied) return denied;
  const body = await request.json();
  const assign = Array.isArray(body.assign) ? body.assign : [];
  const unassign = Array.isArray(body.unassign) ? body.unassign : [];

  const { data: defaultMarket } = await supabase.from("markets").select("id").eq("org_id", orgId).eq("name", "Default").maybeSingle();

  if (assign.length) {
    const { data: valid } = await supabase.from("inbound_numbers").select("e164").eq("org_id", orgId).in("e164", assign);
    if ((valid ?? []).length !== assign.length) return NextResponse.json({ ok: false, error: "Invalid assign e164" }, { status: 400 });
    await supabase.from("inbound_numbers").update({ market_id: params.id }).eq("org_id", orgId).in("e164", assign);
  }
  if (unassign.length) {
    const { data: valid } = await supabase.from("inbound_numbers").select("e164").eq("org_id", orgId).in("e164", unassign);
    if ((valid ?? []).length !== unassign.length) return NextResponse.json({ ok: false, error: "Invalid unassign e164" }, { status: 400 });
    await supabase.from("inbound_numbers").update({ market_id: defaultMarket?.id ?? null }).eq("org_id", orgId).in("e164", unassign);
  }
  return NextResponse.json({ ok: true, assigned: assign.length, unassigned: unassign.length });
}
