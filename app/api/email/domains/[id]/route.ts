import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { buildDnsRecords, deleteDomainIdentity } from "@/lib/ses-identities";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { data: domain, error } = await supabase.from("email_domains").select("*").eq("org_id", orgId).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!domain) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  const { data: senders, error: sendersError } = await supabase.from("email_senders").select("*").eq("org_id", orgId).eq("domain_id", domain.id);
  if (sendersError) return NextResponse.json({ ok: false, error: sendersError.message }, { status: 500 });
  return NextResponse.json({ ok: true, domain: { ...domain, dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region), senders: senders || [] } });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { data: domain, error } = await supabase.from("email_domains").select("*").eq("org_id", orgId).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!domain) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  await deleteDomainIdentity(domain.domain);
  const { error: deleteError } = await supabase.from("email_domains").delete().eq("org_id", orgId).eq("id", params.id);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
