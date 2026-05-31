"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { HelpCircle, Loader2, Plus } from "lucide-react"

import { PermissionGate } from "@/components/auth/PermissionGate"
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

export default function EmailDomainsPage() {
  const [domains, setDomains] = useState<DomainWithSenders[]>([])
  const [domain, setDomain] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  async function loadDomains() {
    setLoading(true)
    const response = await fetch("/api/email/domains", { cache: "no-store" })
    const payload = await response.json()
    if (payload.ok) setDomains(payload.domains || [])
    setLoading(false)
  }

  useEffect(() => {
    loadDomains()
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
