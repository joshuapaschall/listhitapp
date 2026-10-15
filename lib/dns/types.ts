// Shapes shared by the DNS check API and the DNS assistant UI. Pure types.

import type { HostFormat, ProviderKey } from "@/lib/dns/providers"

export type RecordType = "A" | "CNAME" | "MX" | "TXT"

export type RecordStatus = "ok" | "missing" | "wrong"

export type RecordCheck = {
  type: RecordType
  host: string
  expectedValue: string
  priority?: number
  optional: boolean
  found: string[]
  status: RecordStatus
  hint: string
}

export type DetectedProvider = { key: ProviderKey; label: string }

export type DnsCheckResponse = {
  ok: true
  domain: string
  zone: string
  status: string
  provider: DetectedProvider & {
    dnsUrl: string | null
    hostFormat: HostFormat
    steps: string[]
    warnings: string[]
  }
  records: RecordCheck[]
  https?: { ok: boolean }
  allRequiredOk: boolean
  checkedAt: string
}
