import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { buildDnsRecords, deriveDomainStatus, getDomainIdentityStatus } from "@/lib/ses-identities";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });
  const { data: existing, error } = await supabaseAdmin.from("email_domains").select("*").eq("org_id", orgId).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!existing) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  const status = await getDomainIdentityStatus(existing.domain);
  const { data: domain, error: updateError } = await supabaseAdmin.from("email_domains").update({ dkim_status: status.dkimStatus, verified_for_sending: status.verifiedForSending, mail_from_status: status.mailFromStatus, status: deriveDomainStatus(status.dkimStatus, status.verifiedForSending), last_checked_at: new Date().toISOString(), dkim_tokens: status.dkimTokens, mail_from_domain: status.mailFromDomain }).eq("org_id", orgId).eq("id", params.id).select("*").maybeSingle();
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, domain: { ...domain, dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region) } });
}
