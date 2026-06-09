"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Globe, Copy, Check, Clock, Trash2, ExternalLink, RefreshCw, Lock, Plus, Zap, Info,
} from "lucide-react"

type DnsRecord = { kind: "routing" | "ownership"; type: string; host: string; value: string }
type DomainRow = { id: string; domain: string; status: string; dns_records: DnsRecord[] }

const REGISTRARS: { key: string; label: string; url: string }[] = [
  { key: "godaddy", label: "GoDaddy", url: "https://dcc.godaddy.com/control/dnsmanagement" },
  { key: "namecheap", label: "Namecheap", url: "https://ap.www.namecheap.com/domains/list/" },
  { key: "cloudflare", label: "Cloudflare", url: "https://dash.cloudflare.com/" },
  { key: "squarespace", label: "Google / Squarespace", url: "https://domains.squarespace.com/" },
  { key: "other", label: "Somewhere else", url: "" },
]

function registrable(d: string): string {
  const p = d.split(".").filter(Boolean)
  return p.length <= 2 ? d : p.slice(-2).join(".")
}

export function CustomDomainCard({ siteId, slug }: { siteId: string; slug: string }) {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState("")
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reg, setReg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const domainsRef = useRef<DomainRow[]>([])
  domainsRef.current = domains

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/domains`)
      const json = await res.json()
      if (json?.ok) {
        setDomains(Array.isArray(json.domains) ? json.domains : [])
        setConfigured(json.configured !== false)
      }
    } catch {
      /* leave empty; surfaced via the add flow if needed */
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    load()
  }, [load])

  const verify = useCallback(
    async (id: string, manual: boolean) => {
      if (manual) setBusyId(id)
      try {
        const res = await fetch(`/api/sites/${siteId}/domains/${id}/verify`, { method: "POST" })
        const json = await res.json()
        if (json?.ok && json.domain) {
          setDomains((prev) => prev.map((d) => (d.id === id ? json.domain : d)))
          if (json.domain.status === "active") {
            if (manual) toast.success("Connected — your site is live on this domain.")
          } else if (manual) {
            toast("Not connected yet — DNS changes can take a few minutes.")
          }
        } else if (manual) {
          toast.error(json?.error || "Couldn't check the domain.")
        }
      } catch {
        if (manual) toast.error("Couldn't check the domain.")
      } finally {
        if (manual) setBusyId(null)
      }
    },
    [siteId],
  )

  useEffect(() => {
    const iv = setInterval(() => {
      const pending = domainsRef.current.filter((d) => d.status !== "active")
      pending.forEach((d) => verify(d.id, false))
    }, 15000)
    return () => clearInterval(iv)
  }, [verify])

  const add = useCallback(async () => {
    const v = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.+$/, "")
    if (!v) return
    setAdding(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: v }),
      })
      const json = await res.json()
      if (json?.ok && json.domain) {
        setDomains((prev) => [json.domain, ...prev])
        setValue("")
        setReg(null)
        toast.success("Domain added — add the DNS record below to finish.")
      } else {
        toast.error(json?.error || "Couldn't add that domain.")
      }
    } catch {
      toast.error("Couldn't add that domain.")
    } finally {
      setAdding(false)
    }
  }, [siteId, value])

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id)
      try {
        const res = await fetch(`/api/sites/${siteId}/domains/${id}`, { method: "DELETE" })
        const json = await res.json()
        if (json?.ok) {
          setDomains((prev) => prev.filter((d) => d.id !== id))
          toast.success("Domain removed.")
        } else {
          toast.error(json?.error || "Couldn't remove the domain.")
        }
      } catch {
        toast.error("Couldn't remove the domain.")
      } finally {
        setBusyId(null)
      }
    },
    [siteId],
  )

  const copy = useCallback((text: string) => {
    try {
      navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
    setCopied(text)
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200)
  }, [])

  const freeDomain = `${slug}.listhit.io`

  const CopyChip = ({ label, text }: { label: string; text: string }) => (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2">
        <span className="truncate font-mono text-sm">{text}</span>
        <button
          type="button"
          onClick={() => copy(text)}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {copied === text ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === text ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  )

  const FreeRow = () => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Free address</div>
        <div className="mt-0.5 font-mono text-sm">{freeDomain}</div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" /> Live
      </span>
    </div>
  )

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Custom domain</h2>
      </div>

      {!configured ? (
        <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info className="mr-1 inline h-4 w-4 align-[-2px]" />
          Domain connecting isn&apos;t switched on for this workspace yet.
        </p>
      ) : null}

      <FreeRow />

      {loading ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : domains.length === 0 ? (
        <div className="mt-4">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Your domain</div>
          <div className="flex flex-wrap gap-2.5">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add()
              }}
              placeholder="yourbrand.com  ·  or  homes.yourbrand.com"
              className="min-w-[220px] flex-1"
            />
            <Button
              onClick={add}
              disabled={adding || !configured}
              className="bg-brand text-brand-fg hover:bg-brand-hover"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {adding ? "Adding…" : "Connect domain"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            We&apos;ll show you exactly what to do next — it&apos;s one copy-and-paste step.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {domains.map((d) => {
            const active = d.status === "active"
            const records = Array.isArray(d.dns_records) ? d.dns_records : []
            return (
              <div key={d.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    {d.domain}
                  </div>
                  {active ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Clock className="h-3.5 w-3.5" /> Waiting on DNS
                    </span>
                  )}
                </div>

                {active ? (
                  <>
                    <div className="mb-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Lock className="h-4 w-4" />
                      Your site is live on this domain and secured with SSL.
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <Button asChild className="bg-brand text-brand-fg hover:bg-brand-hover">
                        <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1.5 h-4 w-4" /> Visit site
                        </a>
                      </Button>
                      <Button variant="ghost" disabled={busyId === d.id} onClick={() => remove(d.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remove domain
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      One quick step and you&apos;re live. SSL is added automatically once it connects.
                    </div>

                    <div className="mb-2 text-sm font-medium">1&nbsp;&nbsp;Where did you buy this domain?</div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {REGISTRARS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setReg(r.key)}
                          className={
                            "rounded-md border px-3 py-2 text-sm transition-colors " +
                            (reg === r.key ? "border-brand border-2 px-[11px] py-[7px]" : "hover:bg-muted")
                          }
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    {reg ? (
                      <div className="mb-4 rounded-md bg-muted px-3 py-2.5 text-sm leading-7 text-muted-foreground">
                        Sign in to {REGISTRARS.find((r) => r.key === reg)?.label}, open the DNS settings for{" "}
                        <span className="font-medium text-foreground">{registrable(d.domain)}</span>, and add the
                        record below.
                        {REGISTRARS.find((r) => r.key === reg)?.url ? (
                          <>
                            <br />
                            <a
                              href={REGISTRARS.find((r) => r.key === reg)?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                              Open {REGISTRARS.find((r) => r.key === reg)?.label} DNS settings{" "}
                              <ExternalLink className="inline h-3.5 w-3.5 align-[-2px]" />
                            </a>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mb-2 text-sm font-medium">2&nbsp;&nbsp;Add this record</div>
                    <div className="space-y-2.5">
                      {records.map((rec, i) => (
                        <div key={i} className="space-y-2.5">
                          <div>
                            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              Type{rec.kind === "ownership" ? " (ownership)" : ""}
                            </div>
                            <div className="inline-flex max-w-[150px] items-center rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                              {rec.type}
                            </div>
                          </div>
                          <CopyChip label="Name / Host" text={rec.host} />
                          <CopyChip label="Value / Points to" text={rec.value} />
                        </div>
                      ))}
                      <div>
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                          TTL (seconds) · recommended
                        </div>
                        <div className="inline-flex max-w-[170px] items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2">
                          <span className="font-mono text-sm">600</span>
                          <button
                            type="button"
                            onClick={() => copy("600")}
                            className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            {copied === "600" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied === "600" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.5 text-xs leading-6 text-muted-foreground">
                      <Zap className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />A TTL of 600 (10 minutes) is recommended —
                      it makes your domain connect faster. No TTL box, or only &ldquo;Automatic&rdquo;? Leave it,
                      that&apos;s fine too.
                    </p>

                    <details className="mt-2.5">
                      <summary className="cursor-pointer text-sm text-sky-600 dark:text-sky-400">
                        What is this, in plain English?
                      </summary>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        A DNS record is a signpost that tells the internet where {d.domain} should point. You pick the
                        type, give it the name and value shown, and set TTL (how long before changes are noticed — lower
                        connects sooner). Nothing else on your domain changes.
                      </p>
                    </details>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <Button
                        onClick={() => verify(d.id, true)}
                        disabled={busyId === d.id}
                        className="bg-brand text-brand-fg hover:bg-brand-hover"
                      >
                        <RefreshCw className={"mr-1.5 h-4 w-4 " + (busyId === d.id ? "animate-spin" : "")} />
                        {busyId === d.id ? "Checking…" : "I've added it — check now"}
                      </Button>
                      <Button variant="ghost" disabled={busyId === d.id} onClick={() => remove(d.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">We&apos;ll keep checking automatically</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {domains.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Add another domain</div>
              <div className="flex flex-wrap gap-2.5">
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") add()
                  }}
                  placeholder="anotherbrand.com"
                  className="min-w-[220px] flex-1"
                />
                <Button onClick={add} disabled={adding || !configured} variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" />
                  {adding ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}
