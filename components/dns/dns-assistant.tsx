"use client"

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { displayHost } from "@/lib/dns/providers"
import type { DnsCheckResponse, RecordCheck } from "@/lib/dns/types"
import { cn } from "@/lib/utils"

// One DNS assistant for website domains and email sending domains: detects
// where the domain is managed, shows that provider's steps, checks every record
// live (green / amber / gray) and explains each problem in plain English.

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@listhit.io"
const REFRESH_MS = 15_000

// Renders **bold** markers from provider steps.
export function Bold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function useSecondsSince(iso: string | null) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
}

function agoLabel(seconds: number | null): string {
  if (seconds == null) return ""
  if (seconds < 5) return "Last checked just now"
  if (seconds < 60) return `Last checked ${seconds}s ago`
  return `Last checked ${Math.round(seconds / 60)} min ago`
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5">
        <span className={cn("min-w-0 flex-1 break-all text-sm", mono && "font-mono")}>{value}</span>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard?.writeText(value).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
            copied ? "text-emerald-600" : "text-muted-foreground hover:text-brand",
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  )
}

function StatusIcon({ status, pending }: { status: RecordCheck["status"] | "pending"; pending?: boolean }) {
  if (pending || status === "pending") return <Circle className="h-5 w-5 shrink-0 text-muted-foreground/60" />
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
  return <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
}

function SummaryPill({ data }: { data: DnsCheckResponse }) {
  const required = data.records.filter((r) => !r.optional)
  const okCount = required.filter((r) => r.status === "ok").length
  if (data.allRequiredOk) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> All set
      </span>
    )
  }
  if (okCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        {okCount} of {required.length} records found
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      Not connected yet
    </span>
  )
}

function ShareDialog({ open, onOpenChange, kind, id, domain }: { open: boolean; onOpenChange: (v: boolean) => void; kind: string; id: string; domain: string }) {
  const [toEmail, setToEmail] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function send() {
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/dns/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, toEmail: toEmail.trim(), note: note.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "We couldn't send that email.")
      toast.success(`Sent the steps to ${toEmail.trim()}`)
      onOpenChange(false)
      setToEmail("")
      setNote("")
    } catch (e: any) {
      setError(e?.message || "We couldn't send that email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email these steps to someone</DialogTitle>
          <DialogDescription>
            Send the exact steps for {domain} to whoever manages it, like your web person or your domain company&apos;s support.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dns-share-email">Their email</Label>
            <Input id="dns-share-email" type="email" placeholder="name@example.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dns-share-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="dns-share-note" rows={3} maxLength={500} placeholder="Can you add these today? Thanks!" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="brand" onClick={send} disabled={sending || !toEmail.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send steps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DnsAssistant({
  kind,
  id,
  domain: domainProp,
  onAllOk,
  headerExtra,
}: {
  kind: "website" | "email"
  id: string
  domain?: string
  onAllOk?: (data: DnsCheckResponse) => void
  headerExtra?: ReactNode
}) {
  const [data, setData] = useState<DnsCheckResponse | null>(null)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const inFlight = useRef(false)
  const wasAllOk = useRef(false)
  const onAllOkRef = useRef(onAllOk)
  onAllOkRef.current = onAllOk
  const seconds = useSecondsSince(data?.checkedAt ?? null)

  const check = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setChecking(true)
    try {
      const res = await fetch(`/api/dns/check?kind=${kind}&id=${encodeURIComponent(id)}`, { cache: "no-store" })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || "We couldn't check your records right now.")
      setData(body)
      setError("")
      // Records found → let the parent re-check status right away (a website
      // then shows "securing" until https loads).
      const allOk = Boolean(body.allRequiredOk)
      if (allOk && !wasAllOk.current) onAllOkRef.current?.(body)
      wasAllOk.current = allOk
    } catch (e: any) {
      setError(e?.message || "We couldn't check your records right now.")
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }, [kind, id])

  useEffect(() => {
    void check()
  }, [check])

  const done = Boolean(data?.allRequiredOk && (kind !== "website" || data?.https?.ok))
  useEffect(() => {
    if (done) return
    const t = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void check()
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [check, done])

  const domain = data?.domain ?? domainProp ?? ""
  const provider = data?.provider
  const generic = !provider || provider.key === "generic"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold tracking-tight">Connect {domain}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {!provider ? (
              "Looking up where your domain is managed…"
            ) : generic ? (
              <>Add these records wherever you manage {domain}.</>
            ) : (
              <>
                Your domain is managed at <span className="font-semibold text-foreground">{provider.label}</span>. Follow these steps there.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {data ? <SummaryPill data={data} /> : null}
          {headerExtra}
        </div>
      </div>

      {provider?.dnsUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href={provider.dnsUrl} target="_blank" rel="noopener noreferrer">
            Open {provider.label} DNS settings <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : null}

      {provider ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {provider.steps.map((step, i) => (
            <li key={i}>
              <Bold text={step} />
            </li>
          ))}
        </ol>
      ) : null}

      {provider?.warnings?.length ? (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {provider.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <Bold text={w} />
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {error && !data ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {!data && !error ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your records…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-2.5">
          {data.records.map((r, i) => {
            const host = displayHost(r.host, data.zone, data.provider.hostFormat)
            return (
              <div
                key={`${r.type}-${r.host}-${i}`}
                className={cn(
                  "rounded-xl border p-3.5",
                  r.status === "ok" ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10" : r.optional ? "border-border" : "border-border bg-card",
                )}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <StatusIcon status={r.status} />
                  <span className="text-sm font-semibold">
                    {r.status === "ok" ? "Found" : r.status === "wrong" ? "Needs a change" : "Not found yet"}
                  </span>
                  {r.optional ? (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Optional
                    </Badge>
                  ) : null}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,1.6fr)]">
                  <CopyField label="Type" value={r.type} />
                  <CopyField label="Name" value={host} />
                  <CopyField label={r.priority != null ? `Value (priority ${r.priority})` : "Value"} value={r.expectedValue} />
                </div>
                {r.status !== "ok" && r.hint ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{r.hint}</p> : null}
                {r.optional && r.status !== "ok" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Recommended for better inbox placement. Already have one? Keep yours.</p>
                ) : null}
              </div>
            )
          })}

          {kind === "website" ? (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5",
                data.https?.ok ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10" : "border-border",
              )}
            >
              {data.https?.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Lock className="h-5 w-5 shrink-0 text-muted-foreground/60" />}
              <div className="min-w-0">
                <div className="text-sm font-semibold">Secure connection (https)</div>
                <p className="text-xs text-muted-foreground">
                  {data.https?.ok
                    ? `https://${domain} loads securely.`
                    : data.allRequiredOk
                      ? "Records found. We're securing your site now, usually within an hour."
                      : "Turns on automatically after your records are found."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void check()} disabled={checking}>
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          {checking ? "Checking…" : "Check now"}
        </Button>
        {data ? <span className="text-xs text-muted-foreground">{agoLabel(seconds)}</span> : null}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Changes usually show up within 5–30 minutes. You can leave this page; we&apos;ll email you when it&apos;s connected.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
        <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
          <Mail className="h-4 w-4" /> Email these steps to someone
        </Button>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help connecting ${domain}`)}&body=${encodeURIComponent(`Hi, I need help connecting ${domain} to ListHit.`)}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Need help?
        </a>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} kind={kind} id={id} domain={domain} />
    </div>
  )
}
