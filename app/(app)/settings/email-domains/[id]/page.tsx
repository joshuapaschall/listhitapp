"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Clock, Loader2, Plus, RefreshCcw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PermissionGate } from "@/components/auth/PermissionGate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DnsAssistant } from "@/components/dns/dns-assistant"
import type { DnsRecord, EmailDomain, EmailSender } from "@/types/email-identities"

type DomainDetails = EmailDomain & {
  dns_records?: DnsRecord[]
  senders?: EmailSender[]
}

const wrapStyle = { overflowWrap: "anywhere", wordBreak: "break-all" } as const

function statusLabel(status: EmailDomain["status"]) {
  if (status === "verified") return "Verified"
  if (status === "failed") return "Needs attention"
  return "Pending"
}

export default function EmailDomainDetailPage({ params }: { params: { id: string } }) {
  const [domain, setDomain] = useState<DomainDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [manualChecking, setManualChecking] = useState(false)
  const [autoChecking, setAutoChecking] = useState(false)
  const [activeTab, setActiveTab] = useState("dns")
  const [open, setOpen] = useState(false)
  const [mailbox, setMailbox] = useState("")
  const [fromName, setFromName] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const verifyInFlightRef = useRef(false)

  const previewAddress = useMemo(() => `${mailbox.trim() || "deals"}@${domain?.domain || "yourdomain.com"}`, [domain?.domain, mailbox])
  const remainingName = 100 - fromName.length
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
        else if (nextDomain.status === "pending") toast.message("Not verified yet. Changes usually show up within 5–30 minutes.")
        else toast.error("Needs attention — check the records below and try again.")
      } else if (previousStatus === "pending" && nextDomain.status === "verified") {
        toast.success("Verified — ready to send")
      } else if (previousStatus === "pending" && nextDomain.status === "failed") {
        toast.error("Needs attention — check the records below and try again.")
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
    title: "Checking your email sending setup…",
    description: "This usually finishes quickly once your DNS provider has published the records.",
  } : domain.status === "verified" ? {
    className: "border-[#059669]/20 bg-[#ECFDF5] text-[#064E3B]",
    icon: <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#059669]" />,
    title: "Ready to send. Add a from address next.",
    description: "Your domain is verified. Choose the address your emails come from on the From addresses tab.",
  } : domain.status === "failed" ? {
    className: "border-rose-200 bg-rose-50 text-rose-950",
    icon: <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-700" />,
    title: "Needs attention — we couldn't verify your domain.",
    description: "Fix any record marked below, then check again.",
  } : {
    className: "border-amber-200 bg-amber-50 text-amber-950",
    icon: <Clock className="mt-0.5 size-5 shrink-0 text-amber-700" />,
    title: "Not connected yet — add the records below. We check automatically.",
    description: "Changes usually show up within 5–30 minutes. We'll email you when it's set up.",
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
        <p className="text-sm text-muted-foreground">Connect your domain so emails come from your own address and land in the inbox.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="dns" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground">Connect your domain</TabsTrigger>
          <TabsTrigger value="senders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground">From addresses</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6 pt-6" value="dns">
          <div className={`flex gap-3 rounded-lg border p-4 ${statusBanner.className}`}>
            {statusBanner.icon}
            <div className="space-y-1">
              <p className="font-medium">{statusBanner.title}</p>
              <p className="text-sm opacity-80">{statusBanner.description}</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <DnsAssistant
                kind="email"
                id={domain.id}
                domain={domain.domain}
                onAllOk={() => void runVerification({ manual: false })}
                headerExtra={
                  domain.status === "verified" ? null : (
                    <Button disabled={manualChecking} onClick={() => void runVerification({ manual: true })} size="sm" variant="outline">
                      {manualChecking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                      Check sending status
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>
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
