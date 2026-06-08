import { apiError } from "@/lib/api-error"
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/server";

import { requireOrgContext } from "@/lib/auth/org-context";
import { createLogger } from "@/lib/logger";
import { buildDnsRecords, createDomainIdentity, deriveDomainStatus } from "@/lib/ses-identities";

export const dynamic = "force-dynamic";

const log = createLogger("email-domains-route");

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
const FREE_WEBMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
]);
const FREE_WEBMAIL_ERROR = "You can't send from a free email provider like Gmail or Outlook — those can't be verified. Add a domain you own instead. (Replies can still go to your personal inbox — set that with Reply-to on a from-address.)";

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.+$/, "");
}

export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });

  const { data: domains, error } = await supabase.from("email_domains").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return apiError(error, 500, undefined, { ok: false });

  const { data: senders, error: sendersError } = await supabase.from("email_senders").select("*").eq("org_id", orgId);
  if (sendersError) return NextResponse.json({ ok: false, error: sendersError.message }, { status: 500 });

  const enriched = (domains || []).map((domain) => ({
    ...domain,
    dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region),
    senders: (senders || []).filter((sender) => sender.domain_id === domain.id),
  }));

  return NextResponse.json({ ok: true, domains: enriched });
}

export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.email_domains");
  if (denied) return denied;
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 });

  const body = await request.json();
  const normalizedDomain = typeof body?.domain === "string" ? normalizeDomain(body.domain) : "";
  if (!DOMAIN_RE.test(normalizedDomain)) return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  if (FREE_WEBMAIL_DOMAINS.has(normalizedDomain)) return NextResponse.json({ ok: false, error: FREE_WEBMAIL_ERROR }, { status: 422 });

  const { data: existing } = await supabase.from("email_domains").select("id").eq("domain", normalizedDomain).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "That domain is already registered." }, { status: 409 });

  const sesRegion = process.env.AWS_SES_REGION;
  if (!sesRegion) return NextResponse.json({ ok: false, error: "AWS_SES_REGION is not configured." }, { status: 500 });

  let identity;
  try {
    identity = await createDomainIdentity(normalizedDomain);
  } catch (error) {
    log("error", "Failed to create SES domain identity", { domain: normalizedDomain, error: (error as Error)?.message });
    return NextResponse.json({ ok: false, error: "Couldn't create the domain identity in SES. Verify AWS SES IAM permissions (ses:CreateEmailIdentity, ses:PutEmailIdentityMailFromAttributes, ses:GetEmailIdentity) and region configuration." }, { status: 502 });
  }

  const { data: domain, error } = await supabase.from("email_domains").insert({
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
  if (error) return apiError(error, 500, undefined, { ok: false });

  return NextResponse.json({
    ok: true,
    domain: { ...domain, dns_records: buildDnsRecords(domain.domain, domain.dkim_tokens || [], domain.ses_region) },
  });
}
