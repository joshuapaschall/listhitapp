"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Globe, Check, Trash2, ExternalLink, Lock, Plus, Info, ShieldCheck, Loader2 } from "lucide-react"
import { DnsAssistant } from "@/components/dns/dns-assistant"
import { subdomainHost } from "@/lib/websites/site-public-url"

type DnsRecord = { kind: "routing" | "ownership"; type: string; host: string; value: string }
type DomainRow = {
  id: string
  domain: string
  status: string
  dns_records: DnsRecord[]
  https_ok?: boolean
  live_notified_at?: string | null
}

// Live = DNS points at us (status active) AND the site loads over https. Until
// the verify route has checked https this session, a domain we've already
// announced as live keeps showing live.
export function domainIsLive(d: DomainRow): boolean {
  return d.status === "active" && (d.https_ok ?? Boolean(d.live_notified_at))
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
  const [addingAnother, setAddingAnother] = useState(false)
  const domainsRef = useRef<DomainRow[]>([])
  domainsRef.current = domains
  const recheckedRef = useRef(false)

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
    async (id: string) => {
      try {
        const res = await fetch(`/api/sites/${siteId}/domains/${id}/verify`, { method: "POST" })
        const json = await res.json()
        if (json?.ok && json.domain) {
          const before = domainsRef.current.find((d) => d.id === id)
          setDomains((prev) => prev.map((d) => (d.id === id ? json.domain : d)))
          if (before && !domainIsLive(before) && domainIsLive(json.domain)) {
            toast.success(`You're live on ${json.domain.domain}.`)
          }
        }
      } catch {
        /* the next poll retries */
      }
    },
    [siteId],
  )

  // Re-check every domain once on mount — active ones too, so a row marked live
  // before DNS was actually checked gets corrected, and https gets confirmed.
  useEffect(() => {
    if (loading || recheckedRef.current) return
    recheckedRef.current = true
    domainsRef.current.forEach((d) => verify(d.id))
  }, [loading, verify])

  // Keep polling anything that isn't fully live yet (pending DNS, or securing).
  useEffect(() => {
    const iv = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      domainsRef.current.filter((d) => !domainIsLive(d)).forEach((d) => verify(d.id))
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
        setAddingAnother(false)
        toast.success("Domain added. Follow the steps below to connect it.")
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
                  "hidden whitespace-nowrap text-xs font-semibold sm:inline " +
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

  const addRow = (placeholder: string, label: string) => (
    <div className="flex flex-wrap gap-2.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add()
        }}
        placeholder={placeholder}
        className="min-w-[200px] flex-1"
      />
      <Button onClick={add} disabled={adding || !configured} className="bg-brand text-brand-fg hover:bg-brand-hover">
        <Plus className="mr-1.5 h-4 w-4" />
        {adding ? "Adding…" : label}
      </Button>
    </div>
  )

  const removeButton = (id: string, variant: "outline" | "ghost") => (
    <Button variant={variant} disabled={busyId === id} onClick={() => remove(id)}>
      <Trash2 className="mr-1.5 h-4 w-4" /> Remove
    </Button>
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
          Connecting your own domain isn&apos;t switched on for this workspace yet.
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
              Put your site on a domain you own — like <span className="font-mono text-foreground">yourbrand.com</span>.
              We&rsquo;ll walk you through it, one step at a time.
            </p>
          </div>
          {addRow("yourbrand.com  ·  or  homes.yourbrand.com", "Connect")}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Secured automatically · your email keeps working · nothing else on your domain changes
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {domains.map((d) => {
            if (domainIsLive(d)) {
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/20"
                >
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
                    <ShieldCheck className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h3 className="break-words text-lg font-bold tracking-tight">
                    You&rsquo;re live on <span className="text-brand">{d.domain}</span>
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 text-emerald-600" /> Secured with https
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                    <Button asChild className="bg-brand text-brand-fg hover:bg-brand-hover">
                      <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Visit your site
                      </a>
                    </Button>
                    {removeButton(d.id, "outline")}
                  </div>
                </div>
              )
            }
            if (d.status === "active") {
              // DNS is right; the certificate is still being issued.
              return (
                <div key={d.id} className="space-y-3 rounded-xl border p-4">
                  {stepper(3)}
                  <div className="flex items-start gap-3 rounded-lg bg-muted/60 px-3.5 py-3">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" />
                    <div className="min-w-0 text-sm">
                      <div className="font-semibold text-foreground">Connected — securing your site (usually under an hour).</div>
                      <p className="text-muted-foreground">
                        {d.domain} points to your website. We&apos;re turning on https now and will email you when it&apos;s live.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">{removeButton(d.id, "ghost")}</div>
                </div>
              )
            }
            return (
              <div key={d.id} className="space-y-4 rounded-xl border p-4">
                {stepper(2)}
                <DnsAssistant kind="website" id={d.id} domain={d.domain} onAllOk={() => verify(d.id)} />
                <div className="flex flex-wrap gap-2.5">{removeButton(d.id, "ghost")}</div>
              </div>
            )
          })}

          {addingAnother ? (
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
          )}
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="text-left">{content}</div>
  }

  return <Card className="p-5">{content}</Card>
}
