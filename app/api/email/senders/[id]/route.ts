import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body?.from_name !== undefined) update.from_name = typeof body.from_name === "string" ? body.from_name.trim() : null;
  if (body?.is_default !== undefined) update.is_default = Boolean(body.is_default);
  if (update.is_default === true) await supabaseAdmin.from("email_senders").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
  const { data: sender, error } = await supabaseAdmin.from("email_senders").update(update).eq("org_id", orgId).eq("id", params.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!sender) return NextResponse.json({ ok: false, error: "Sender not found" }, { status: 404 });
  return NextResponse.json({ ok: true, sender });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { error } = await supabaseAdmin.from("email_senders").delete().eq("org_id", orgId).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
