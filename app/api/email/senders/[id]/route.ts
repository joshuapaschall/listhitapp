import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FROM_NAME_LENGTH = 100;

function normalizeOptionalEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });

  const { data: existingSender, error: existingError } = await supabaseAdmin.from("email_senders").select("*").eq("org_id", orgId).eq("id", params.id).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  if (!existingSender) return NextResponse.json({ ok: false, error: "Sender not found" }, { status: 404 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body?.from_name !== undefined) {
    const fromName = typeof body.from_name === "string" ? body.from_name.trim() : null;
    if (fromName && fromName.length > MAX_FROM_NAME_LENGTH) return NextResponse.json({ ok: false, error: "Display name must be 100 characters or fewer." }, { status: 422 });
    update.from_name = fromName;
  }
  if (body?.reply_to !== undefined) {
    const replyTo = normalizeOptionalEmail(body.reply_to);
    if (replyTo && !EMAIL_RE.test(replyTo)) return NextResponse.json({ ok: false, error: "Enter a valid Reply-to email address." }, { status: 422 });
    update.reply_to = replyTo;
  }
  if (body?.is_default !== undefined) update.is_default = Boolean(body.is_default);

  if (update.is_default === true) {
    const { error: unsetError } = await supabaseAdmin.from("email_senders").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
    if (unsetError) return NextResponse.json({ ok: false, error: unsetError.message }, { status: 500 });
  }

  const { data: sender, error } = await supabaseAdmin.from("email_senders").update(update).eq("org_id", orgId).eq("id", params.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!sender) return NextResponse.json({ ok: false, error: "Sender not found" }, { status: 404 });
  return NextResponse.json({ ok: true, sender });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { error } = await supabaseAdmin.from("email_senders").delete().eq("org_id", orgId).eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
