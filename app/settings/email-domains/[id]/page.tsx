"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Copy, Loader2, Plus, RefreshCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

function displayRecordName(record: DnsRecord) {
  return record.priority ? `${record.priority} ${record.name}` : record.name
}

export default function EmailDomainDetailPage({ params }: { params: { id: string } }) {
  const [domain, setDomain] = useState<DomainDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)
  const [mailbox, setMailbox] = useState("")
  const [fromName, setFromName] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const previewAddress = useMemo(() => `${mailbox.trim() || "deals"}@${domain?.domain || "yourdomain.com"}`, [domain?.domain, mailbox])
  const remainingName = 100 - fromName.length

  async function loadDomain() {
    setLoading(true)
    const response = await fetch(`/api/email/domains/${params.id}`, { cache: "no-store" })
    const payload = await response.json()
    if (payload.ok) setDomain(payload.domain)
    setLoading(false)
  }

  useEffect(() => {
    loadDomain()
  }, [])

  async function verifyDomain() {
    setRefreshing(true)
    const response = await fetch(`/api/email/domains/${params.id}/verify`, { method: "POST" })
    const payload = await response.json()
    if (payload.ok) setDomain((current) => ({ ...current, ...payload.domain, senders: current?.senders || [] }) as DomainDetails)
    setRefreshing(false)
  }

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
      setError(payload.error || "Could not add this from-address.")
      setSaving(false)
      return
    }
    setMailbox("")
    setFromName("")
    setReplyTo("")
    setOpen(false)
    setSaving(false)
    await loadDomain()
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading domain…
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!domain) {
    return (
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
    )
  }

  return (
    <div className="space-y-6 p-6">
      <Button asChild variant="ghost">
        <Link href="/settings/email-domains">
          <ArrowLeft className="size-4" />
          Back to domains
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-start gap-2">
            <h1 className="text-2xl font-semibold tracking-tight" style={wrapStyle}>{domain.domain}</h1>
            <Badge variant={domain.status === "verified" ? "default" : "secondary"}>{statusLabel(domain.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Add these DNS records at your domain provider, then verify when they have propagated.</p>
        </div>
        <Button disabled={refreshing} onClick={verifyDomain} variant="outline">
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Check verification
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DNS records</CardTitle>
          <CardDescription>Copy each host and value exactly. Values wrap so you can always see the full record.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(domain.dns_records || []).map((record, index) => {
                const host = displayRecordName(record)
                const key = `${record.type}-${index}`
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{record.type}</TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <code className="font-mono text-xs" style={wrapStyle}>{host}</code>
                        <Button className="shrink-0 self-start" onClick={() => copyValue(`${key}-host`, host)} size="icon" type="button" variant="ghost">
                          {copied === `${key}-host` ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <code className="font-mono text-xs" style={wrapStyle}>{record.value}</code>
                        <Button className="shrink-0 self-start" onClick={() => copyValue(`${key}-value`, record.value)} size="icon" type="button" variant="ghost">
                          {copied === `${key}-value` ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                      {record.name.startsWith("_dmarc.") ? (
                        <p className="mt-2 text-xs text-muted-foreground">Already have a DMARC record on this domain? Keep your existing one — don&apos;t add a second.</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                  <Input id="from-name" maxLength={100} onChange={(event) => setFromName(event.target.value)} placeholder="ListHit Deals" value={fromName} />
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
    </div>
  )
}
