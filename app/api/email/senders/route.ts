import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domain_id");
  let query = supabaseAdmin.from("email_senders").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (domainId) query = query.eq("domain_id", domainId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, senders: data || [] });
}

export async function POST(request: Request) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const body = await request.json();
  const domainId = typeof body?.domain_id === "string" ? body.domain_id : "";
  const fromEmail = typeof body?.from_email === "string" ? body.from_email.trim().toLowerCase() : "";
  const fromName = typeof body?.from_name === "string" ? body.from_name.trim() : null;
  const isDefault = Boolean(body?.is_default);
  const { data: domain, error: domainError } = await supabaseAdmin.from("email_domains").select("*").eq("org_id", orgId).eq("id", domainId).maybeSingle();
  if (domainError) return NextResponse.json({ ok: false, error: domainError.message }, { status: 500 });
  if (!domain) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  if (domain.status !== "verified") return NextResponse.json({ ok: false, error: "Verify this domain before adding a from-address." }, { status: 422 });
  const emailDomain = fromEmail.split("@")[1] || "";
  if (emailDomain !== domain.domain) return NextResponse.json({ ok: false, error: "From email must match the verified domain." }, { status: 422 });
  if (isDefault) await supabaseAdmin.from("email_senders").update({ is_default: false }).eq("org_id", orgId).eq("is_default", true);
  const { data: sender, error } = await supabaseAdmin.from("email_senders").insert({ org_id: orgId, domain_id: domain.id, from_email: fromEmail, from_name: fromName, is_default: isDefault }).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sender });
}
