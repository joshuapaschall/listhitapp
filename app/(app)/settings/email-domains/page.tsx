"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, HelpCircle, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { PermissionGate } from "@/components/auth/PermissionGate"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { EmailDomain, EmailSender } from "@/types/email-identities"

type DomainWithSenders = EmailDomain & {
  senders?: EmailSender[]
}

const WEBMAIL_ERROR = "You can't send from a free email provider like Gmail or Outlook — those can't be verified. Add a domain you own instead. (Replies can still go to your personal inbox — set that with Reply-to on a from-address.)"

function statusLabel(status: EmailDomain["status"]) {
  if (status === "verified") return "Verified"
  if (status === "failed") return "Needs attention"
  return "Pending"
}

type GuardState = {
  frozen: boolean
  override: { overrideUntil: string } | null
}

const OVERRIDE_CONFIRM_TEXT =
  "Only do this after removing hard bounces and validating your list. This lifts the freeze for 2 hours; the guard automatically re-checks after that. Sending to a dirty list again can get your AWS account suspended."

export default function EmailDomainsPage() {
  const [domains, setDomains] = useState<DomainWithSenders[]>([])
  const [domain, setDomain] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [guard, setGuard] = useState<GuardState | null>(null)
  const [overriding, setOverriding] = useState(false)

  async function loadDomains() {
    setLoading(true)
    const response = await fetch("/api/email/domains", { cache: "no-store" })
    const payload = await response.json()
    if (payload.ok) setDomains(payload.domains || [])
    setLoading(false)
  }

  async function loadGuard() {
    try {
      const response = await fetch("/api/admin/email-guard/override", { cache: "no-store" })
      const payload = await response.json()
      if (payload.ok) setGuard({ frozen: Boolean(payload.frozen), override: payload.override ?? null })
    } catch {
      // Non-fatal: the banner just won't show.
    }
  }

  async function activateOverride() {
    setOverriding(true)
    try {
      const response = await fetch("/api/admin/email-guard/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 2, reason: "Operator cleaned list from Email Domains page" }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        toast.error(payload.error || "Failed to resume sending")
        return
      }
      toast.success(
        `Sending resumed — ${payload.resumedCampaigns} campaign(s), ${payload.resumedQueue} queued email(s)`,
      )
      await loadGuard()
    } finally {
      setOverriding(false)
    }
  }

  async function cancelOverride() {
    setOverriding(true)
    try {
      const response = await fetch("/api/admin/email-guard/override", { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        toast.error(payload.error || "Failed to cancel override")
        return
      }
      toast.success("Override cancelled — the guard is active again")
      await loadGuard()
    } finally {
      setOverriding(false)
    }
  }

  useEffect(() => {
    loadDomains()
    loadGuard()
  }, [])

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const response = await fetch("/api/email/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      setError(payload.error || WEBMAIL_ERROR)
      setSaving(false)
      return
    }
    setDomain("")
    setOpen(false)
    setSaving(false)
    await loadDomains()
  }

  return (
    <PermissionGate permission="settings.email_domains" title="Email domains">
      <TooltipProvider>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email domains</h1>
            <p className="text-sm text-muted-foreground">
              Verify a domain you own before sending campaign email from ListHit.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form className="space-y-4" onSubmit={addDomain}>
                <DialogHeader>
                  <DialogTitle>Add a sending domain</DialogTitle>
                  <DialogDescription>
                    Add your main domain or a campaign subdomain. We’ll generate the DNS records you need.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button aria-label="What&apos;s a subdomain?" className="text-muted-foreground hover:text-foreground" type="button">
                          <HelpCircle className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        A subdomain is a prefix on your domain, like deals.yourdomain.com. You don&apos;t buy or set it up separately — it&apos;s created automatically when you add the DNS records below.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input id="domain" onChange={(event) => setDomain(event.target.value)} placeholder="yourdomain.com" value={domain} />
                  <p className="text-sm text-muted-foreground">
                    Use your main domain (yourdomain.com) or a subdomain (deals.yourdomain.com). A subdomain keeps your campaign reputation separate from your everyday email.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You don&apos;t need to create the subdomain first — just enter it and add the records we generate. The subdomain is created automatically when you do.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t have a domain yet? You&apos;ll need one to send — they&apos;re about $12/year at providers like Namecheap, Cloudflare, or Porkbun and take a few minutes to set up.
                  </p>
                </div>
                {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
                <DialogFooter>
                  <Button disabled={saving} type="submit">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Add domain
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {guard?.frozen ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Email sending is frozen — your recent bounce rate is too high.
                  </p>
                  {guard.override ? (
                    <p className="text-sm text-muted-foreground">
                      Override active until {new Date(guard.override.overrideUntil).toLocaleString()}. Sending is on while you clean your list.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Remove hard bounces and validate your list, then resume for a bounded window.
                    </p>
                  )}
                </div>
              </div>
              {guard.override ? (
                <Button variant="outline" disabled={overriding} onClick={cancelOverride}>
                  {overriding ? <Loader2 className="size-4 animate-spin" /> : null}
                  Cancel override
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={overriding}>
                      I&apos;ve cleaned my list — resume sending (2h)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resume sending for 2 hours?</AlertDialogTitle>
                      <AlertDialogDescription>{OVERRIDE_CONFIRM_TEXT}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={activateOverride}>Resume sending</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading domains…
            </CardContent>
          </Card>
        ) : domains.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No sending domains yet</CardTitle>
              <CardDescription>
                Add a domain you own so you can send from addresses like <span className="font-mono">you@yourdomain.com</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setOpen(true)}>Add your first domain</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {domains.map((item) => (
              <Link href={`/settings/email-domains/${item.id}`} key={item.id}>
                <Card className="transition hover:border-primary/50">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <CardTitle className="text-lg" style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}>
                        {item.domain}
                      </CardTitle>
                      <Badge variant={item.status === "verified" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                    </div>
                    <CardDescription>
                      {(item.senders || []).length} from-address{(item.senders || []).length === 1 ? "" : "es"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      </TooltipProvider>
    </PermissionGate>
  )
}
