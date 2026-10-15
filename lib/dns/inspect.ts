import "server-only"

import { Resolver } from "node:dns/promises"

import { PROVIDERS, type ProviderKey } from "@/lib/dns/providers"
import type { DetectedProvider, RecordCheck, RecordType } from "@/lib/dns/types"

export type { DetectedProvider, RecordCheck, RecordStatus, RecordType } from "@/lib/dns/types"

// Live DNS checks for the DNS assistant. Uses public resolvers (Cloudflare,
// Google) on a dedicated Resolver so results reflect the public internet, not a
// stale local cache. Every hint is plain English for a non-technical customer.

export type ExpectedRecord = {
  type: RecordType
  host: string // fully qualified, e.g. "www.example.com"
  value: string
  priority?: number
  optional?: boolean // shown, never blocks "all set" (e.g. DMARC)
  // TXT match mode: "exact" (default) or "prefix" (any record starting with the
  // value's first token counts — an existing DMARC policy is fine to keep).
  match?: "exact" | "prefix"
}

// Vercel serves apex domains from any of these and CNAMEs from *.vercel-dns(-NNN).com.
const VERCEL_APEX_IPS = new Set(["76.76.21.21", "216.198.79.1", "216.198.79.65"])
const VERCEL_CNAME_RE = /(^|\.)vercel-dns(-\d+)?\.com$/

export function createResolver(): Resolver {
  const r = new Resolver({ timeout: 4000, tries: 2 })
  r.setServers(["1.1.1.1", "8.8.8.8"])
  return r
}

export function normalizeDnsValue(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/\.+$/, "")
}

function normalizeTxt(value: string): string {
  return normalizeDnsValue(value).replace(/^"|"$/g, "").replace(/\s+/g, " ").replace(/;\s*$/, "")
}

// Two-label public suffixes we see in practice; good enough for registrable domains.
const TWO_LEVEL_SUFFIXES = new Set(["co.uk", "org.uk", "me.uk", "com.au", "net.au", "org.au", "co.nz", "com.mx", "com.br", "co.za", "co.in"])

export function registrableDomain(domain: string): string {
  const labels = normalizeDnsValue(domain).split(".").filter(Boolean)
  if (labels.length <= 2) return labels.join(".")
  const lastTwo = labels.slice(-2).join(".")
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo
}

const NS_PATTERNS: Array<[RegExp, ProviderKey]> = [
  [/domaincontrol\.com$/, "godaddy"],
  [/registrar-servers\.com$/, "namecheap"],
  [/ns\.cloudflare\.com$/, "cloudflare"],
  [/(squarespacedns\.com|googledomains\.com)$/, "squarespace"],
  [/porkbun\.com$/, "porkbun"],
  [/(dns-parking\.com|hostinger)/, "hostinger"],
  [/ui-dns\./, "ionos"],
  [/wixdns\.net$/, "wix"],
  [/bluehost\.com$/, "bluehost"],
  [/worldnic\.com$/, "networksolutions"],
  [/vercel-dns\.com$/, "vercel"],
]

export function providerFromNameservers(nameservers: string[]): DetectedProvider {
  for (const ns of nameservers.map(normalizeDnsValue)) {
    for (const [re, key] of NS_PATTERNS) {
      if (re.test(ns)) return { key, label: PROVIDERS[key].label }
    }
  }
  return { key: "generic", label: PROVIDERS.generic.label }
}

export async function detectProvider(domain: string, resolver: Resolver = createResolver()): Promise<DetectedProvider> {
  try {
    const ns = await resolver.resolveNs(registrableDomain(domain))
    return providerFromNameservers(ns)
  } catch {
    return { key: "generic", label: PROVIDERS.generic.label }
  }
}

function notFound(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === "ENODATA" || code === "ENOTFOUND" || code === "ESERVFAIL" || code === "NOTFOUND" || code === "ENONAME"
}

async function lookup<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn()
  } catch (err) {
    if (notFound(err)) return []
    throw err
  }
}

function listOf(values: string[]): string {
  if (values.length <= 1) return values[0] ?? ""
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`
}

function countWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five"][n] ?? String(n)
}

const MISSING_HINT = "We don't see this record yet."

async function checkA(r: Resolver, exp: ExpectedRecord): Promise<Omit<RecordCheck, "type" | "host" | "expectedValue" | "optional" | "priority">> {
  const found = (await lookup(() => r.resolve4(exp.host))).map(normalizeDnsValue)
  const expected = normalizeDnsValue(exp.value)
  const matches = (ip: string) => ip === expected || (VERCEL_APEX_IPS.has(expected) && VERCEL_APEX_IPS.has(ip))
  if (!found.length) {
    // A CNAME on the same name hides any A record.
    const cname = await lookup(() => r.resolveCname(exp.host)).catch(() => [] as string[])
    if (cname.length) {
      return { found: cname.map(normalizeDnsValue), status: "wrong", hint: `This name points to ${normalizeDnsValue(cname[0])}. Delete that record, then add this one.` }
    }
    return { found, status: "missing", hint: MISSING_HINT }
  }
  const good = found.filter(matches)
  const others = found.filter((ip) => !matches(ip))
  if (!others.length) return { found, status: "ok", hint: "" }
  if (good.length) {
    return {
      found,
      status: "wrong",
      hint:
        others.length === 1
          ? `You have ${countWord(found.length)} records here. Delete the one that isn't ${exp.value}.`
          : `You have ${countWord(found.length)} records here. Delete the ones that aren't ${exp.value}.`,
    }
  }
  return {
    found,
    status: "wrong",
    hint:
      others.length === 1
        ? `This points to ${others[0]}. Change it to ${exp.value}.`
        : `This points to ${listOf(others)}. Change one to ${exp.value} and delete the others.`,
  }
}

async function checkCname(r: Resolver, exp: ExpectedRecord) {
  const found = (await lookup(() => r.resolveCname(exp.host))).map(normalizeDnsValue)
  const expected = normalizeDnsValue(exp.value)
  const matches = (v: string) => v === expected || (VERCEL_CNAME_RE.test(expected) && VERCEL_CNAME_RE.test(v))
  if (!found.length) {
    const a = await lookup(() => r.resolve4(exp.host)).catch(() => [] as string[])
    if (a.length) {
      return { found: a, status: "wrong" as const, hint: `This name has a different kind of record pointing to ${a[0]}. Delete it, then add this one.` }
    }
    return { found, status: "missing" as const, hint: MISSING_HINT }
  }
  if (found.some(matches)) return { found, status: "ok" as const, hint: "" }
  return { found, status: "wrong" as const, hint: `This points to ${found[0]}. Change it to ${exp.value}.` }
}

async function checkMx(r: Resolver, exp: ExpectedRecord) {
  const records = await lookup(() => r.resolveMx(exp.host))
  const found = records.map((m) => normalizeDnsValue(m.exchange))
  const expected = normalizeDnsValue(exp.value)
  if (!found.length) return { found, status: "missing" as const, hint: MISSING_HINT }
  if (found.includes(expected)) return { found, status: "ok" as const, hint: "" }
  return { found, status: "wrong" as const, hint: `This points to ${found[0]}. Change it to ${exp.value}.` }
}

async function checkTxt(r: Resolver, exp: ExpectedRecord) {
  const found = (await lookup(() => r.resolveTxt(exp.host))).map((chunks) => chunks.join(""))
  const expected = normalizeTxt(exp.value)
  if (!found.length) return { found, status: "missing" as const, hint: MISSING_HINT }
  const norm = found.map(normalizeTxt)
  if (norm.includes(expected)) return { found, status: "ok" as const, hint: "" }
  const tag = expected.split(/[\s;]/)[0] // "v=spf1", "v=dmarc1", ...
  const sameKind = tag.startsWith("v=") ? norm.filter((v) => v.startsWith(tag)) : []
  if (sameKind.length && exp.match === "prefix") return { found, status: "ok" as const, hint: "" }
  if (sameKind.length) {
    return { found, status: "wrong" as const, hint: `There's already a different record here starting with ${tag}. Replace its value with the one below.` }
  }
  return { found, status: "missing" as const, hint: "We see other records on this name, but not this one yet. Add it alongside them." }
}

export async function checkRecords(expected: ExpectedRecord[], resolver: Resolver = createResolver()): Promise<RecordCheck[]> {
  return Promise.all(
    expected.map(async (exp) => {
      const base = {
        type: exp.type,
        host: normalizeDnsValue(exp.host),
        expectedValue: exp.value,
        optional: Boolean(exp.optional),
        ...(exp.priority != null ? { priority: exp.priority } : {}),
      }
      try {
        const result =
          exp.type === "A"
            ? await checkA(resolver, exp)
            : exp.type === "CNAME"
              ? await checkCname(resolver, exp)
              : exp.type === "MX"
                ? await checkMx(resolver, exp)
                : await checkTxt(resolver, exp)
        return { ...base, ...result }
      } catch {
        return { ...base, found: [], status: "missing" as const, hint: "We couldn't check this right now. We'll try again in a moment." }
      }
    }),
  )
}

export async function checkHttps(domain: string, timeoutMs = 6000): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`https://${normalizeDnsValue(domain)}`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    return { ok: res.status < 500 }
  } catch {
    // TLS errors, DNS failures and timeouts all land here.
    return { ok: false }
  }
}
