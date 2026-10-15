// DNS inspector: provider detection from nameservers, record checks with
// plain-English hints, and per-provider host formatting. The Resolver is a fake.

import { checkRecords, detectProvider, normalizeDnsValue, providerFromNameservers, registrableDomain } from "@/lib/dns/inspect"
import { PROVIDERS, displayHost, providerSteps, KEEP_EMAIL_LINE } from "@/lib/dns/providers"

type Table = Record<string, unknown[] | Error>

function notFound() {
  return Object.assign(new Error("queryA ENODATA"), { code: "ENODATA" })
}

function fakeResolver(tables: { a?: Table; cname?: Table; mx?: Table; txt?: Table; ns?: Table }) {
  const get = (t: Table | undefined, host: string) => {
    const v = t?.[host]
    if (v instanceof Error) return Promise.reject(v)
    if (!v) return Promise.reject(notFound())
    return Promise.resolve(v)
  }
  return {
    resolve4: (h: string) => get(tables.a, h),
    resolveCname: (h: string) => get(tables.cname, h),
    resolveMx: (h: string) => get(tables.mx, h),
    resolveTxt: (h: string) => get(tables.txt, h),
    resolveNs: (h: string) => get(tables.ns, h),
  } as any
}

describe("provider detection", () => {
  test.each([
    ["ns51.domaincontrol.com", "godaddy"],
    ["dns1.registrar-servers.com", "namecheap"],
    ["kate.ns.cloudflare.com", "cloudflare"],
    ["ns-cloud-a1.googledomains.com", "squarespace"],
    ["dns1.p01.squarespacedns.com.", "squarespace"],
    ["curitiba.ns.porkbun.com", "porkbun"],
    ["ns1.dns-parking.com", "hostinger"],
    ["ns1.hostinger.com", "hostinger"],
    ["ns1045.ui-dns.com", "ionos"],
    ["ns2.wixdns.net", "wix"],
    ["ns1.bluehost.com", "bluehost"],
    ["ns23.worldnic.com", "networksolutions"],
    ["ns1.vercel-dns.com", "vercel"],
    ["ns1.somewhere-else.net", "generic"],
  ])("%s → %s", (ns, key) => {
    const p = providerFromNameservers([ns])
    expect(p.key).toBe(key)
    expect(p.label).toBe(PROVIDERS[key as keyof typeof PROVIDERS].label)
  })

  test("detectProvider looks up the registrable domain's nameservers", async () => {
    const r = fakeResolver({ ns: { "example.com": ["ns51.domaincontrol.com", "ns52.domaincontrol.com"] } })
    expect(await detectProvider("www.example.com", r)).toEqual({ key: "godaddy", label: "GoDaddy" })
  })

  test("a failed nameserver lookup falls back to generic", async () => {
    expect((await detectProvider("example.com", fakeResolver({}))).key).toBe("generic")
  })

  test("registrable domain handles subdomains and two-level suffixes", () => {
    expect(registrableDomain("abc._domainkey.example.com")).toBe("example.com")
    expect(registrableDomain("homes.brand.co.uk")).toBe("brand.co.uk")
  })
})

describe("A records", () => {
  const expected = [{ type: "A" as const, host: "example.com", value: "76.76.21.21" }]

  test("ok when the only A record matches", async () => {
    const [r] = await checkRecords(expected, fakeResolver({ a: { "example.com": ["76.76.21.21"] } }))
    expect(r).toMatchObject({ status: "ok", found: ["76.76.21.21"], hint: "" })
  })

  test("missing with a plain hint when nothing is there", async () => {
    const [r] = await checkRecords(expected, fakeResolver({}))
    expect(r).toMatchObject({ status: "missing", hint: "We don't see this record yet." })
  })

  test("wrong when it points somewhere else, with the exact change", async () => {
    const [r] = await checkRecords(expected, fakeResolver({ a: { "example.com": ["34.12.9.1"] } }))
    expect(r.status).toBe("wrong")
    expect(r.hint).toBe("This points to 34.12.9.1. Change it to 76.76.21.21.")
  })

  test("two A records (ours + a parked one) → wrong, delete the other one", async () => {
    const [r] = await checkRecords(expected, fakeResolver({ a: { "example.com": ["76.76.21.21", "34.12.9.1"] } }))
    expect(r.status).toBe("wrong")
    expect(r.hint).toBe("You have two records here. Delete the one that isn't 76.76.21.21.")
  })
})

describe("CNAME, MX and TXT", () => {
  test("CNAME with a trailing dot and different case equals the expected value", async () => {
    const [r] = await checkRecords(
      [{ type: "CNAME", host: "abc._domainkey.example.com", value: "abc.dkim.amazonses.com" }],
      fakeResolver({ cname: { "abc._domainkey.example.com": ["ABC.dkim.amazonses.com."] } }),
    )
    expect(r.status).toBe("ok")
    expect(normalizeDnsValue("Cname.Vercel-DNS.com.")).toBe("cname.vercel-dns.com")
  })

  test("MX matches on the exchange host", async () => {
    const [r] = await checkRecords(
      [{ type: "MX", host: "bounce.example.com", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10 }],
      fakeResolver({ mx: { "bounce.example.com": [{ exchange: "feedback-smtp.us-east-1.amazonses.com.", priority: 10 }] } }),
    )
    expect(r).toMatchObject({ status: "ok", priority: 10 })
  })

  test("TXT: an existing different SPF is wrong; an existing DMARC counts for an optional prefix match", async () => {
    const results = await checkRecords(
      [
        { type: "TXT", host: "bounce.example.com", value: "v=spf1 include:amazonses.com ~all" },
        { type: "TXT", host: "_dmarc.example.com", value: "v=DMARC1; p=none;", optional: true, match: "prefix" },
      ],
      fakeResolver({ txt: { "bounce.example.com": [["v=spf1 include:_spf.google.com ~all"]], "_dmarc.example.com": [["v=DMARC1; p=quarantine; rua=mailto:x@example.com"]] } }),
    )
    expect(results[0].status).toBe("wrong")
    expect(results[0].hint).toMatch(/Replace its value/)
    expect(results[1]).toMatchObject({ status: "ok", optional: true })
  })
})

describe("host formatting per provider", () => {
  test("relative providers drop the domain; apex becomes @", () => {
    expect(displayHost("example.com", "example.com", PROVIDERS.godaddy.hostFormat)).toBe("@")
    expect(displayHost("www.example.com", "example.com", PROVIDERS.namecheap.hostFormat)).toBe("www")
    expect(displayHost("bounce.example.com.", "example.com", PROVIDERS.cloudflare.hostFormat)).toBe("bounce")
    expect(displayHost("abc._domainkey.example.com", "example.com", PROVIDERS.squarespace.hostFormat)).toBe("abc._domainkey")
  })

  test("generic (unknown provider) shows the full name", () => {
    expect(PROVIDERS.generic.hostFormat).toBe("fqdn")
    expect(displayHost("abc._domainkey.example.com", "example.com", PROVIDERS.generic.hostFormat)).toBe("abc._domainkey.example.com")
  })

  test("every provider's steps end with the keep-your-email line; Cloudflare warns about the proxy", () => {
    for (const key of Object.keys(PROVIDERS)) {
      const steps = providerSteps(key, [{ type: "A", host: "@", value: "76.76.21.21" }])
      expect(steps[steps.length - 1]).toBe(KEEP_EMAIL_LINE)
    }
    expect(PROVIDERS.cloudflare.warnings).toEqual(["Set Proxy status to **DNS only** (gray cloud)."])
    expect(PROVIDERS.godaddy.steps([])[4]).toBe("On the **Forwarding** tab, make sure domain forwarding is off.")
  })
})
