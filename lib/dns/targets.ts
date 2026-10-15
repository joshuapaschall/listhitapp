import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { buildDnsRecords } from "@/lib/ses-identities"
import { dnsRecordsFor } from "@/lib/vercel/domains"
import { registrableDomain, type ExpectedRecord } from "@/lib/dns/inspect"

// The domain a DNS assistant is about, and the records it needs — loaded only
// when the row belongs to the caller's org.

export type DnsKind = "website" | "email"

export type DnsTarget = {
  kind: DnsKind
  id: string
  domain: string
  zone: string
  status: string
  expected: ExpectedRecord[]
}

export function parseDnsKind(value: unknown): DnsKind | null {
  return value === "website" || value === "email" ? value : null
}

// dnsRecordsFor hosts are "@", a subdomain label, "www", or a full ownership name.
export function websiteExpectedRecords(domain: string, verification: unknown): ExpectedRecord[] {
  const name = domain.toLowerCase()
  return dnsRecordsFor(name, Array.isArray(verification) ? (verification as any[]) : null).map((r) => {
    let host: string
    if (r.kind === "ownership") host = r.host
    else if (r.host === "@") host = name
    else if (r.host === "www") host = `www.${name}`
    else host = name // a subdomain's routing record lives on the subdomain itself
    return { type: r.type as ExpectedRecord["type"], host, value: r.value }
  })
}

export function emailExpectedRecords(domain: string, dkimTokens: string[], region: string): ExpectedRecord[] {
  return buildDnsRecords(domain, dkimTokens, region).map((r) => ({
    type: r.type,
    host: r.name,
    value: r.value,
    ...(r.priority != null ? { priority: r.priority } : {}),
    // DMARC is recommended, never required; any existing policy is fine to keep.
    ...(r.recommended ? { optional: true, match: "prefix" as const } : {}),
  }))
}

export async function loadDnsTarget(orgId: string, kind: DnsKind, id: string): Promise<DnsTarget | null> {
  if (!id) return null
  if (kind === "website") {
    const { data } = await supabaseAdmin
      .from("site_domains")
      .select("id, domain, status, verification")
      .eq("org_id", orgId)
      .eq("id", id)
      .eq("type", "custom")
      .maybeSingle()
    const row = data as { id: string; domain: string; status: string; verification: unknown } | null
    if (!row) return null
    return {
      kind,
      id: row.id,
      domain: row.domain,
      zone: registrableDomain(row.domain),
      status: row.status,
      expected: websiteExpectedRecords(row.domain, row.verification),
    }
  }

  const { data } = await supabaseAdmin
    .from("email_domains")
    .select("id, domain, status, dkim_tokens, ses_region")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle()
  const row = data as { id: string; domain: string; status: string; dkim_tokens: string[] | null; ses_region: string } | null
  if (!row) return null
  return {
    kind,
    id: row.id,
    domain: row.domain,
    zone: registrableDomain(row.domain),
    status: row.status,
    expected: emailExpectedRecords(row.domain, row.dkim_tokens || [], row.ses_region),
  }
}
