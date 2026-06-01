import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/server";
import { requireOrgContext } from "@/lib/auth/org-context";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_FROM_NAME_LENGTH = 100;

function normalizeOptionalEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function validateEmail(value: string) {
  return EMAIL_RE.test(value);
}

export async function GET(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domain_id");
  let query = supabase.from("email_senders").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (domainId) query = query.eq("domain_id", domainId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, senders: data || [] });
}

export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const body = await request.json();
  const domainId = typeof body?.domain_id === "string" ? body.domain_id : "";
  const fromEmail = typeof body?.from_email === "string" ? body.from_email.trim().toLowerCase() : "";
  const fromName = typeof body?.from_name === "string" ? body.from_name.trim() : null;
  const replyTo = normalizeOptionalEmail(body?.reply_to);
  const isDefault = Boolean(body?.is_default);

  if (!validateEmail(fromEmail)) return NextResponse.json({ ok: false, error: "Enter a valid from-address." }, { status: 422 });
  const localPart = fromEmail.split("@")[0] || "";
  if (localPart.length > MAX_LOCAL_PART_LENGTH) return NextResponse.json({ ok: false, error: "The mailbox part before @ must be 64 characters or fewer." }, { status: 422 });
  if (fromName && fromName.length > MAX_FROM_NAME_LENGTH) return NextResponse.json({ ok: false, error: "Display name must be 100 characters or fewer." }, { status: 422 });
  if (replyTo && !validateEmail(replyTo)) return NextResponse.json({ ok: false, error: "Enter a valid Reply-to email address." }, { status: 422 });

  const { data: domain, error: domainError } = await supabase.from("email_domains").select("*").eq("org_id", orgId).eq("id", domainId).maybeSingle();
  if (domainError) return NextResponse.json({ ok: false, error: domainError.message }, { status: 500 });
  if (!domain) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  if (domain.status !== "verified") return NextResponse.json({ ok: false, error: "Verify this domain before adding a from-address." }, { status: 422 });
  const emailDomain = fromEmail.split("@")[1] || "";
  if (emailDomain !== domain.domain) return NextResponse.json({ ok: false, error: "From email must match the verified domain." }, { status: 422 });
  if (isDefault) await supabase.from("email_senders").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
  const { data: sender, error } = await supabase.from("email_senders").insert({ org_id: orgId, domain_id: domain.id, from_email: fromEmail, from_name: fromName, reply_to: replyTo, is_default: isDefault }).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sender });
}
