import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOrgContext, validatePatchBody } from "../../_shared";

export async function PATCH(request: Request, { params }: { params: { e164: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const validation = validatePatchBody(body);
  if (validation.error) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  const update = validation.update ?? {};
    if (body.config_override !== undefined) update.config_override = Boolean(body.config_override);

  const { data: number, error: updateError } = await supabaseAdmin
    .from("inbound_numbers")
    .update(update)
    .eq("org_id", orgId)
    .eq("e164", decodeURIComponent(params.e164))
    .select("e164, label, enabled, config_override, voicemail_greeting_url, voicemail_greeting_source, call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds")
    .maybeSingle();
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, number });
}
