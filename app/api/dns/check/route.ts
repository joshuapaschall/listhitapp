import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { checkHttps, checkRecords, detectProvider } from "@/lib/dns/inspect"
import { providerGuide, providerSteps } from "@/lib/dns/providers"
import { loadDnsTarget, parseDnsKind } from "@/lib/dns/targets"
import type { DnsCheckResponse } from "@/lib/dns/types"

export const dynamic = "force-dynamic"

// Live results per domain for 20s: the assistant polls every 15s, and several
// tabs/admins may watch the same domain.
const CACHE_MS = 20_000
const cache = new Map<string, { at: number; body: Omit<DnsCheckResponse, "status"> }>()

export async function GET(request: Request) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const params = new URL(request.url).searchParams
  const kind = parseDnsKind(params.get("kind"))
  const id = (params.get("id") || "").trim()
  if (!kind || !id) return apiError("kind (website|email) and id are required", 400)

  try {
    const target = await loadDnsTarget(orgId, kind, id)
    if (!target) return apiError("Domain not found", 404)

    const key = `${kind}:${target.domain}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return NextResponse.json({ ...hit.body, status: target.status })
    }

    const [detected, records, https] = await Promise.all([
      detectProvider(target.domain),
      checkRecords(target.expected),
      kind === "website" ? checkHttps(target.domain) : Promise.resolve(undefined),
    ])
    const guide = providerGuide(detected.key)
    const body: Omit<DnsCheckResponse, "status"> = {
      ok: true,
      domain: target.domain,
      zone: target.zone,
      provider: {
        ...detected,
        dnsUrl: guide.dnsUrl ? guide.dnsUrl(target.zone) : null,
        hostFormat: guide.hostFormat,
        steps: providerSteps(detected.key, target.expected),
        warnings: guide.warnings ?? [],
      },
      records,
      ...(https ? { https } : {}),
      allRequiredOk: records.filter((r) => !r.optional).every((r) => r.status === "ok"),
      checkedAt: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), body })
    return NextResponse.json({ ...body, status: target.status })
  } catch (err) {
    return apiError(err, 500)
  }
}
