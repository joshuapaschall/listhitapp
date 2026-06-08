// lib/vercel/domains.ts
//
// Thin client for Vercel's Project Domains API — used to connect tenant custom
// domains to this project (Vercel routes the host + provisions SSL). Reads
// VERCEL_API_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID at call time. When the
// token or project id is missing, vercelConfigured() is false and callers
// surface a "not configured" state instead of crashing.

const API = "https://api.vercel.com"

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID)
}

function teamQuery(): string {
  const t = process.env.VERCEL_TEAM_ID
  return t ? `?teamId=${encodeURIComponent(t)}` : ""
}

export interface VercelVerification {
  type: string
  domain: string
  value: string
  reason?: string
}
export interface VercelDomainResult {
  name: string
  apexName?: string
  verified: boolean
  verification?: VercelVerification[]
}

async function vercelFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    // Bubble up a concise, sanitized message; routes wrap it with apiError.
    const msg = json?.error?.message || `Vercel API error (${res.status})`
    const err = new Error(msg) as Error & { status?: number; code?: string }
    err.status = res.status
    err.code = json?.error?.code
    throw err
  }
  return json
}

const projectId = () => encodeURIComponent(process.env.VERCEL_PROJECT_ID || "")
const enc = (d: string) => encodeURIComponent(d)

export async function addProjectDomain(name: string): Promise<VercelDomainResult> {
  return vercelFetch(`/v10/projects/${projectId()}/domains${teamQuery()}`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function getProjectDomain(name: string): Promise<VercelDomainResult> {
  return vercelFetch(`/v9/projects/${projectId()}/domains/${enc(name)}${teamQuery()}`, {
    method: "GET",
  })
}

export async function verifyProjectDomain(name: string): Promise<VercelDomainResult> {
  return vercelFetch(`/v9/projects/${projectId()}/domains/${enc(name)}/verify${teamQuery()}`, {
    method: "POST",
  })
}

export async function removeProjectDomain(name: string): Promise<void> {
  // 404 is fine on delete — treat "already gone" as success.
  try {
    await vercelFetch(`/v9/projects/${projectId()}/domains/${enc(name)}${teamQuery()}`, {
      method: "DELETE",
    })
  } catch (e: any) {
    if (e?.status !== 404) throw e
  }
}

// ---- DNS guidance (what the tenant must add at their registrar) ----
export interface DnsRecord {
  kind: "routing" | "ownership"
  type: string // A | CNAME | TXT
  host: string // "@" or subdomain label or the verification domain
  value: string
}

function isApex(name: string): boolean {
  return name.split(".").filter(Boolean).length <= 2
}

// Routing record (points the host at Vercel) + any Vercel ownership TXT records.
export function dnsRecordsFor(
  name: string,
  verification?: VercelVerification[] | null,
): DnsRecord[] {
  const records: DnsRecord[] = []
  if (isApex(name)) {
    records.push({ kind: "routing", type: "A", host: "@", value: "76.76.21.21" })
  } else {
    records.push({
      kind: "routing",
      type: "CNAME",
      host: name.split(".")[0],
      value: "cname.vercel-dns.com",
    })
  }
  for (const v of verification || []) {
    if ((v.type || "").toUpperCase() === "TXT") {
      records.push({ kind: "ownership", type: "TXT", host: v.domain, value: v.value })
    }
  }
  return records
}
