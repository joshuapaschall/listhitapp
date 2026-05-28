import { NextResponse } from "next/server";

import { requireOrgContext } from "@/lib/auth/org-context";
import { buildDnsRecords, createDomainIdentity, deriveDomainStatus } from "@/lib/ses-identities";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.+$/, "");
}

export async function GET() {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });

  const { data: domains, error } = await supabaseAdmin.from("email_domains").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: senders, error: sendersError } = await supabaseAdmin.from("email_senders").select("*").eq("org_id", orgId);
  if (sendersError) return NextResponse.json({ ok: false, error: sendersError.message }, { status: 500 });

  const enriched = (domains || []).map((domain) => ({
    ...domain,
    dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region),
    senders: (senders || []).filter((sender) => sender.domain_id === domain.id),
  }));

  return NextResponse.json({ ok: true, domains: enriched });
}

export async function POST(request: Request) {
  const { user, orgId } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });

  const body = await request.json();
  const normalizedDomain = typeof body?.domain === "string" ? normalizeDomain(body.domain) : "";
  if (!DOMAIN_RE.test(normalizedDomain)) return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("email_domains").select("id").eq("domain", normalizedDomain).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "That domain is already registered." }, { status: 409 });

  const sesRegion = process.env.AWS_SES_REGION;
  if (!sesRegion) return NextResponse.json({ ok: false, error: "AWS_SES_REGION is not configured." }, { status: 500 });

  const identity = await createDomainIdentity(normalizedDomain);
  const { data: domain, error } = await supabaseAdmin.from("email_domains").insert({
    org_id: orgId,
    domain: normalizedDomain,
    ses_region: sesRegion,
    dkim_tokens: identity.dkimTokens,
    dkim_status: identity.dkimStatus,
    verified_for_sending: identity.verifiedForSending,
    mail_from_domain: identity.mailFromDomain,
    mail_from_status: identity.mailFromStatus,
    status: deriveDomainStatus(identity.dkimStatus, identity.verifiedForSending),
  }).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    domain: { ...domain, dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region) },
  });
}
