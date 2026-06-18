"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Globe, Copy, Check, Trash2, ExternalLink, RefreshCw, Lock, Plus, Zap, Info, ShieldCheck,
} from "lucide-react"
import { subdomainHost } from "@/lib/websites/site-public-url"

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

export function CustomDomainCard({
  siteId,
  slug,
  embedded = false,
}: {
  siteId: string
  slug: string
  embedded?: boolean
}) {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState("")
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reg, setReg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [addingAnother, setAddingAnother] = useState(false)
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
        setAddingAnother(false)
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

  const freeDomain = subdomainHost(slug)

  function stepper(active: number) {
    const steps = ["Add domain", "Point it to us", "Go live"]
    return (
      <div className="mb-1 flex items-center">
        {steps.map((label, i) => {
          const n = i + 1
          const done = n < active
          const isActive = n === active
          return (
            <div key={label} className={"flex items-center gap-2 " + (i < 2 ? "flex-1" : "flex-none")}>
              <span
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors " +
                  (done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : isActive
                      ? "border-brand bg-brand text-brand-fg ring-4 ring-brand/15"
                      : "border-border bg-background text-muted-foreground")
                }
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={
                  "whitespace-nowrap text-xs font-semibold " +
                  (isActive ? "text-brand" : done ? "text-foreground" : "text-muted-foreground")
                }
              >
                {label}
              </span>
              {i < 2 ? <span className={"mx-2.5 h-0.5 flex-1 rounded " + (done ? "bg-emerald-600" : "bg-border")} /> : null}
            </div>
          )
        })}
      </div>
    )
  }

  function instructionRow(lead: ReactNode, text: string, key: string) {
    const isCopied = copied === text
    return (
      <div key={key} className="flex items-center gap-3">
        <div className="w-[120px] shrink-0 text-xs leading-tight text-muted-foreground">{lead}</div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
          <span className="truncate font-mono text-sm font-semibold">{text}</span>
          <button
            type="button"
            onClick={() => copy(text)}
            className={
              "inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold " +
              (isCopied ? "text-emerald-600" : "text-muted-foreground hover:text-brand")
            }
          >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {isCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    )
  }

  const addRow = (placeholder: string, label: string) => (
    <div className="flex flex-wrap gap-2.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add()
        }}
        placeholder={placeholder}
        className="min-w-[220px] flex-1"
      />
      <Button onClick={add} disabled={adding || !configured} className="bg-brand text-brand-fg hover:bg-brand-hover">
        <Plus className="mr-1.5 h-4 w-4" />
        {adding ? "Adding…" : label}
      </Button>
    </div>
  )

  const content = (
    <>
      {!embedded ? (
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Globe className="h-[18px] w-[18px] text-brand" /> Custom domain
          </h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            You&rsquo;re already live at <span className="font-mono text-foreground">{freeDomain}</span>
          </div>
        </div>
      ) : null}

      {!configured ? (
        <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info className="mr-1 inline h-4 w-4 align-[-2px]" />
          Domain connecting isn&apos;t switched on for this workspace yet.
        </p>
      ) : null}

      {loading ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : domains.length === 0 ? (
        <div className="space-y-4">
          {stepper(1)}
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">Use your own domain</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Put your site on a domain you own — like{" "}
              <span className="font-mono text-foreground">yourbrand.com</span>. We&rsquo;ll walk you through it, one step
              at a time.
            </p>
          </div>
          {addRow("yourbrand.com  ·  or  homes.yourbrand.com", "Connect")}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            About 2 minutes · SSL added automatically · nothing else on your domain changes
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {domains.map((d) => {
            const active = d.status === "active"
            const records = Array.isArray(d.dns_records) ? d.dns_records : []
            if (active) {
              return (
                <div key={d.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
                    <ShieldCheck className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">
                    You&rsquo;re live on <span className="text-brand">{d.domain}</span>
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 text-emerald-600" /> Secured with SSL automatically
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                    <Button asChild className="bg-brand text-brand-fg hover:bg-brand-hover">
                      <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Visit your site
                      </a>
                    </Button>
                    <Button variant="outline" disabled={busyId === d.id} onClick={() => remove(d.id)}>
                      <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              )
            }
            return (
              <div key={d.id} className="space-y-4 rounded-xl border p-4">
                {stepper(2)}

                <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  One quick step and <span className="font-medium text-foreground">{d.domain}</span> is live. SSL is added
                  automatically once it connects.
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold">Where did you buy {registrable(d.domain)}?</div>
                  {reg ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <span>
                          <span className="text-muted-foreground">Registrar:</span>{" "}
                          <span className="font-medium">{REGISTRARS.find((r) => r.key === reg)?.label}</span>
                        </span>
                        <button type="button" onClick={() => setReg(null)} className="text-xs font-semibold text-brand">
                          Change
                        </button>
                      </div>
                      {REGISTRARS.find((r) => r.key === reg)?.url ? (
                        <a
                          href={REGISTRARS.find((r) => r.key === reg)?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                        >
                          Open {REGISTRARS.find((r) => r.key === reg)?.label} DNS settings
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {REGISTRARS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setReg(r.key)}
                          className="rounded-lg border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold">Add this record</div>
                  <p className="mb-2.5 text-sm text-muted-foreground">
                    In your DNS settings, add a new record with these exact values:
                  </p>
                  <div className="space-y-2.5 rounded-xl border border-brand/30 bg-brand/5 p-3.5">
                    {records.map((rec, i) => (
                      <div key={i} className="space-y-2.5">
                        {instructionRow(
                          <>
                            Set the <span className="font-semibold text-foreground">Type</span> to
                            {rec.kind === "ownership" ? " (ownership)" : ""}
                          </>,
                          rec.type,
                          `t-${i}`,
                        )}
                        {instructionRow(
                          <>
                            Set the <span className="font-semibold text-foreground">Name / Host</span> to
                          </>,
                          rec.host,
                          `h-${i}`,
                        )}
                        {instructionRow(
                          <>
                            Paste into <span className="font-semibold text-foreground">Value</span>
                          </>,
                          rec.value,
                          `v-${i}`,
                        )}
                      </div>
                    ))}
                    <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                      <span>
                        <span className="font-semibold text-foreground">TTL:</span> 600 connects faster. Only see
                        &ldquo;Automatic&rdquo;? Leave it — that&rsquo;s fine.
                      </span>
                    </div>
                  </div>

                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
                      What is this, in plain English?
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      A DNS record is a signpost that tells the internet where {d.domain} should point. You&rsquo;re
                      pointing it at us so your site shows up there. Nothing else about your domain or email changes.
                    </p>
                  </details>
                </div>

                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3.5 py-3">
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-brand" />
                  <span className="text-xs leading-snug text-muted-foreground">
                    We&rsquo;re checking automatically — this can take a few minutes after you save.{" "}
                    <span className="font-semibold text-foreground">Keep this open.</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
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
                </div>
              </div>
            )
          })}

          {domains.length > 0 ? (
            addingAnother ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add another domain</div>
                {addRow("anotherbrand.com", "Add")}
                <button
                  type="button"
                  onClick={() => {
                    setAddingAnother(false)
                    setValue("")
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingAnother(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" /> Add another domain
              </button>
            )
          ) : null}
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="text-left">{content}</div>
  }

  return <Card className="p-5">{content}</Card>
}
