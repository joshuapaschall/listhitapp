"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Check, Clock, Copy, Loader2, Plus, RefreshCcw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PermissionGate } from "@/components/auth/PermissionGate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DnsRecord, EmailDomain, EmailSender } from "@/types/email-identities"

type DomainDetails = EmailDomain & {
  dns_records?: DnsRecord[]
  senders?: EmailSender[]
}

type Provider = "godaddy" | "cloudflare" | "namecheap" | "squarespace" | "other"
type RecordGroup = {
  title: string
  description: string
  records: DnsRecord[]
}

const wrapStyle = { overflowWrap: "anywhere", wordBreak: "break-all" } as const

const providerTips: Record<Provider, string> = {
  godaddy: "GoDaddy auto-appends your domain to the Host, so enter only the part BEFORE .{domain}.",
  cloudflare: "Cloudflare tip: set proxy status to DNS only.",
  namecheap: "Namecheap auto-appends your domain to the Host, so enter only the part BEFORE .{domain}.",
  squarespace: "Squarespace / Google tip: open DNS settings for this domain, then add each record by Type, Host/Name, and Value.",
  other: "Other provider tip: find DNS/Manage DNS; if it appends your domain to the Host, omit your domain from what you paste.",
}

function statusLabel(status: EmailDomain["status"]) {
  if (status === "verified") return "Verified"
  if (status === "failed") return "Needs attention"
  return "Pending"
}

function getProviderTip(provider: Provider | "", domain: string) {
  if (!provider) return null
  return providerTips[provider].replace("{domain}", domain)
}

function getRecordGroups(records: DnsRecord[]): RecordGroup[] {
  const dkimRecords = records.filter((record) => record.type === "CNAME" && record.name.includes("._domainkey."))
  const dmarcRecords = records.filter((record) => record.name.startsWith("_dmarc."))
  const bounceRecords = records.filter((record) => !dkimRecords.includes(record) && !dmarcRecords.includes(record))

  return [
    {
      title: "DKIM signature",
      description: "Proves the email is genuinely from you. Add all three.",
      records: dkimRecords,
    },
    {
      title: "Bounce handling / MAIL FROM",
      description: "Routes bounces and authenticates your mail.",
      records: bounceRecords,
    },
    {
      title: "DMARC",
      description: "Optional, but improves inbox placement.",
      records: dmarcRecords,
    },
  ].filter((group) => group.records.length > 0)
}

export default function EmailDomainDetailPage({ params }: { params: { id: string } }) {
  const [domain, setDomain] = useState<DomainDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [manualChecking, setManualChecking] = useState(false)
  const [autoChecking, setAutoChecking] = useState(false)
  const [activeTab, setActiveTab] = useState("dns")
  const [provider, setProvider] = useState<Provider | "">("")
  const [open, setOpen] = useState(false)
  const [mailbox, setMailbox] = useState("")
  const [fromName, setFromName] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const verifyInFlightRef = useRef(false)

  const previewAddress = useMemo(() => `${mailbox.trim() || "deals"}@${domain?.domain || "yourdomain.com"}`, [domain?.domain, mailbox])
  const remainingName = 100 - fromName.length
  const recordGroups = useMemo(() => getRecordGroups(domain?.dns_records || []), [domain?.dns_records])
  const providerTip = useMemo(() => getProviderTip(provider, domain?.domain || "yourdomain.com"), [domain?.domain, provider])
  const checking = manualChecking || autoChecking

  const loadDomain = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/email/domains/${params.id}`, { cache: "no-store" })
    const payload = await response.json()
    if (payload.ok) setDomain(payload.domain)
    setLoading(false)
  }, [params.id])

  const runVerification = useCallback(async ({ manual }: { manual: boolean }) => {
    if (verifyInFlightRef.current) return null
    verifyInFlightRef.current = true
    if (manual) setManualChecking(true)
    else setAutoChecking(true)

    try {
      const previousStatus = domain?.status
      const response = await fetch(`/api/email/domains/${params.id}/verify`, { method: "POST" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not check verification.")

      const nextDomain = { ...payload.domain, senders: domain?.senders || [] } as DomainDetails
      setDomain(nextDomain)

      if (manual) {
        if (nextDomain.status === "verified") toast.success("Verified — ready to send")
        else if (nextDomain.status === "pending") toast.message("Not verified yet — DNS can take a few minutes to a few hours to propagate.")
        else toast.error("Needs attention — check the DNS records below and try again.")
      } else if (previousStatus === "pending" && nextDomain.status === "verified") {
        toast.success("Verified — ready to send")
      } else if (previousStatus === "pending" && nextDomain.status === "failed") {
        toast.error("Needs attention — check the DNS records below and try again.")
      }

      return nextDomain
    } catch (verifyError) {
      if (manual) toast.error((verifyError as Error).message)
      return null
    } finally {
      verifyInFlightRef.current = false
      if (manual) setManualChecking(false)
      else setAutoChecking(false)
    }
  }, [domain?.senders, domain?.status, params.id])

  useEffect(() => {
    void loadDomain()
  }, [loadDomain])

  useEffect(() => {
    if (activeTab !== "dns" || domain?.status !== "pending") return undefined

    const interval = window.setInterval(() => {
      if (!verifyInFlightRef.current) void runVerification({ manual: false })
    }, 10000)

    return () => window.clearInterval(interval)
  }, [activeTab, domain?.status, runVerification])

  async function copyValue(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  async function addSender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!domain) return
    setSaving(true)
    setError(null)
    const response = await fetch("/api/email/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain_id: domain.id,
        from_email: `${mailbox.trim()}@${domain.domain}`,
        from_name: fromName,
        reply_to: replyTo,
      }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      const message = payload.error || "Could not add this from-address."
      setError(message)
      toast.error(message)
      setSaving(false)
      return
    }
    setMailbox("")
    setFromName("")
    setReplyTo("")
    setOpen(false)
    setSaving(false)
    toast.success("From-address added")
    await loadDomain()
  }

  if (loading) {
    return (
      <PermissionGate permission="settings.email_domains" title="Email domains">
        <div className="space-y-6 p-6">
        <Skeleton className="h-9 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        </div>
      </PermissionGate>
    )
  }

  if (!domain) {
    return (
      <PermissionGate permission="settings.email_domains" title="Email domains">
        <div className="space-y-4 p-6">
        <Button asChild variant="ghost">
          <Link href="/settings/email-domains">
            <ArrowLeft className="size-4" />
            Back to domains
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Domain not found</CardTitle>
            <CardDescription>We couldn&apos;t load this email domain.</CardDescription>
          </CardHeader>
        </Card>
        </div>
      </PermissionGate>
    )
  }

  const statusBanner = checking ? {
    className: "border-blue-200 bg-blue-50 text-blue-950",
    icon: <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-700" />,
    title: "Verifying… checking your DNS records with SES.",
    description: "This usually finishes quickly once your DNS provider has published the records.",
  } : domain.status === "verified" ? {
    className: "border-[#059669]/20 bg-[#ECFDF5] text-[#064E3B]",
    icon: <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#059669]" />,
    title: "Verified — ready to send. Add from-addresses next.",
    description: "Your sending domain is verified and available for campaign from-addresses.",
  } : domain.status === "failed" ? {
    className: "border-rose-200 bg-rose-50 text-rose-950",
    icon: <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-700" />,
    title: "Needs attention — DNS verification failed.",
    description: "Review the records below, fix any mismatches, then check verification again.",
  } : {
    className: "border-amber-200 bg-amber-50 text-amber-950",
    icon: <Clock className="mt-0.5 size-5 shrink-0 text-amber-700" />,
    title: "Not verified yet — add the records below; we check automatically every 10s.",
    description: "DNS updates can take a few minutes to a few hours depending on your provider.",
  }

  return (
    <PermissionGate permission="settings.email_domains" title="Email domains">
      <div className="space-y-6 p-6">
      <Button asChild variant="ghost">
        <Link href="/settings/email-domains">
          <ArrowLeft className="size-4" />
          Back to domains
        </Link>
      </Button>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="text-2xl font-semibold tracking-tight" style={wrapStyle}>{domain.domain}</h1>
          <Badge variant={domain.status === "verified" ? "default" : "secondary"}>{statusLabel(domain.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Add these DNS records at your domain provider, then verify when they have propagated.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="dns" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700">DNS setup</TabsTrigger>
          <TabsTrigger value="senders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700">From addresses</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6 pt-6" value="dns">
          <div className={`flex gap-3 rounded-lg border p-4 ${statusBanner.className}`}>
            {statusBanner.icon}
            <div className="space-y-1">
              <p className="font-medium">{statusBanner.title}</p>
              <p className="text-sm opacity-80">{statusBanner.description}</p>
              {autoChecking ? <p className="text-xs opacity-75">Checking…</p> : null}
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>How to add these</CardTitle>
                <CardDescription>Use the copy buttons below to avoid typos.</CardDescription>
              </div>
              <Button className={domain.status === "verified" ? "bg-[#059669] text-white hover:bg-[#047857]" : ""} disabled={manualChecking} onClick={() => void runVerification({ manual: true })} variant={domain.status === "verified" ? "default" : "outline"}>
                {manualChecking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                Check verification
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  "Open your DNS provider, wherever you manage the domain — usually where you bought it.",
                  "Create each record below by Type, Host/Name (left) and Value (right), using the copy buttons.",
                  "Come back and click Check verification, or just wait — it re-checks automatically.",
                ].map((step, index) => (
                  <div className="rounded-md border bg-muted/20 p-3" key={step}>
                    <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">{index + 1}</div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Where is your domain registered?</Label>
                <Select onValueChange={(value) => setProvider(value as Provider)} value={provider}>
                  <SelectTrigger className="max-w-sm" id="provider">
                    <SelectValue placeholder="Choose your provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="godaddy">GoDaddy</SelectItem>
                    <SelectItem value="cloudflare">Cloudflare</SelectItem>
                    <SelectItem value="namecheap">Namecheap</SelectItem>
                    <SelectItem value="squarespace">Squarespace / Google</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {providerTip ? <p className="max-w-2xl rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{providerTip}</p> : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {recordGroups.map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle>{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.records.map((record, index) => {
                    const key = `${group.title}-${record.type}-${index}`
                    return (
                      <div className="rounded-md border p-4" key={key}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{record.type}</Badge>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Host/Name</Label>
                            <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3">
                              <code className="font-mono text-xs" style={wrapStyle}>{record.name}</code>
                              <Button className="shrink-0 self-start" onClick={() => copyValue(`${key}-host`, record.name)} size="icon" type="button" variant="ghost">
                                {copied === `${key}-host` ? <Check className="size-4" /> : <Copy className="size-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label>Value</Label>
                              {record.priority ? <span className="text-xs text-muted-foreground">priority {record.priority}</span> : null}
                            </div>
                            <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3">
                              <code className="font-mono text-xs" style={wrapStyle}>{record.value}</code>
                              <Button className="shrink-0 self-start" onClick={() => copyValue(`${key}-value`, record.value)} size="icon" type="button" variant="ghost">
                                {copied === `${key}-value` ? <Check className="size-4" /> : <Copy className="size-4" />}
                              </Button>
                            </div>
                            {record.name.startsWith("_dmarc.") ? (
                              <p className="text-xs text-muted-foreground">Already have a DMARC record on this domain? Keep your existing one — don&apos;t add a second.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent className="pt-6" value="senders">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>From-addresses</CardTitle>
                <CardDescription>These are the sender addresses your campaigns can use on this verified domain.</CardDescription>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button disabled={domain.status !== "verified"}>
                    <Plus className="size-4" />
                    Add from-address
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form className="space-y-4" onSubmit={addSender}>
                    <DialogHeader>
                      <DialogTitle>Add a from-address</DialogTitle>
                      <DialogDescription>Choose the mailbox and optional sender details recipients will see.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="mailbox">Mailbox</Label>
                      <Input id="mailbox" maxLength={64} onChange={(event) => setMailbox(event.target.value)} placeholder="deals" value={mailbox} />
                      <p className="font-mono text-sm text-muted-foreground" style={wrapStyle}>Full address: {previewAddress}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="from-name">Display name</Label>
                        <span className="text-xs text-muted-foreground">{remainingName} left</span>
                      </div>
                      <Input id="from-name" maxLength={100} onChange={(event) => setFromName(event.target.value)} placeholder="Your company name" value={fromName} />
                      <p className="text-sm text-muted-foreground">Shown to recipients as the sender. Keep it short and recognizable.</p>
                    </div>
                    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                      <Label className="text-sm font-medium" htmlFor="reply-to">Reply-to email <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Input id="reply-to" onChange={(event) => setReplyTo(event.target.value)} placeholder="you@gmail.com" type="email" value={replyTo} />
                      <p className="text-sm text-muted-foreground">
                        Where replies go. Leave blank to reply to the from-address. You can use any inbox — even a personal Gmail — handy if you don&apos;t have email set up on your own domain yet.
                      </p>
                    </div>
                    {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
                    <DialogFooter>
                      <Button disabled={saving || !mailbox.trim()} type="submit">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                        Add from-address
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(domain.senders || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No from-addresses yet.</p>
              ) : (
                <div className="space-y-3">
                  {(domain.senders || []).map((sender) => (
                    <div className="rounded-md border p-4" key={sender.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          {sender.from_name ? <p className="font-medium" style={wrapStyle}>{sender.from_name}</p> : null}
                          <p className="font-mono text-sm" style={wrapStyle}>{sender.from_email}</p>
                          {sender.reply_to ? <p className="text-sm text-muted-foreground" style={wrapStyle}>Replies → {sender.reply_to}</p> : null}
                        </div>
                        {sender.is_default ? <Badge variant="secondary">Default</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PermissionGate>
  )
}
