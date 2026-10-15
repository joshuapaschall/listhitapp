"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import { toast } from "sonner"

import { DnsAssistant } from "@/components/dns/dns-assistant"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EmailDomain, EmailSender } from "@/types/email-identities"

// Email setup as one guided path over the existing email-domain flow:
// domain → connect it (DNS assistant) → choose a from address → test it.

type Domain = EmailDomain & { senders?: EmailSender[] }

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

function normalizeDomain(v: string) {
  return v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\.+$/, "")
}

function hostOf(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : ""
  } catch {
    return ""
  }
}

export function EmailStep() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [domain, setDomain] = useState<Domain | null>(null)
  const [domainInput, setDomainInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [defaults, setDefaults] = useState({ name: "", email: "" })
  const [mailbox, setMailbox] = useState("deals")
  const [fromName, setFromName] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [savingSender, setSavingSender] = useState(false)
  const [senderError, setSenderError] = useState("")
  const [testing, setTesting] = useState(false)
  const verifying = useRef(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [domainsRes, defaultsRes, orgRes] = await Promise.all([
          fetch("/api/email/domains", { cache: "no-store" }),
          fetch("/api/onboarding/site-defaults").catch(() => null),
          fetch("/api/organization").catch(() => null),
        ])
        const domainsBody = await domainsRes.json().catch(() => null)
        const d = defaultsRes && defaultsRes.ok ? await defaultsRes.json().catch(() => null) : null
        const org = orgRes && orgRes.ok ? await orgRes.json().catch(() => null) : null
        if (!active) return
        if (!domainsRes.ok || !domainsBody?.ok) throw new Error(domainsBody?.error || "load")
        const list: Domain[] = domainsBody.domains || []
        setDomain(list.find((x) => x.status === "verified") ?? list[0] ?? null)
        const name = d?.name || ""
        const email = d?.business?.email || ""
        setDefaults({ name, email })
        setFromName(name)
        setReplyTo(email)
        const site = hostOf(org?.website_url ?? org?.organization?.website_url)
        if (site && !site.endsWith("listhit.io")) setDomainInput(site)
      } catch {
        if (active) setError("We couldn't load your email setup. Try refreshing the page.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const verify = useCallback(async () => {
    if (!domain || verifying.current) return
    verifying.current = true
    try {
      const res = await fetch(`/api/email/domains/${domain.id}/verify`, { method: "POST" })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.ok) {
        setDomain((prev) => (prev ? { ...prev, ...body.domain, senders: prev.senders } : body.domain))
        if (body.domain.status === "verified" && domain.status !== "verified") {
          toast.success("Your domain is connected")
          void queryClient.invalidateQueries({ queryKey: ["onboarding"] })
        }
      }
    } finally {
      verifying.current = false
    }
  }, [domain, queryClient])

  // Keep checking with the email provider while the domain is still connecting.
  useEffect(() => {
    if (!domain || domain.status === "verified") return
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void verify()
    }, 15_000)
    return () => clearInterval(t)
  }, [domain, verify])

  async function addDomain() {
    const value = normalizeDomain(domainInput)
    if (!DOMAIN_RE.test(value)) {
      setError("Enter a domain like yourbrand.com (no https:// or email address).")
      return
    }
    setAdding(true)
    setError("")
    try {
      const res = await fetch("/api/email/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) {
        if (res.status === 409) throw new Error("That domain is already connected to an account. Email support if it's yours.")
        if (res.status === 422) throw new Error(body?.error || "Use a domain you own.")
        throw new Error("We couldn't add that domain. Try again in a minute.")
      }
      setDomain({ ...body.domain, senders: [] })
    } catch (e: any) {
      setError(e?.message || "We couldn't add that domain.")
    } finally {
      setAdding(false)
    }
  }

  async function addSender() {
    if (!domain) return
    const box = mailbox.trim().toLowerCase()
    if (!/^[a-z0-9._+-]{1,64}$/.test(box)) {
      setSenderError("Use letters, numbers, dots or dashes, like deals.")
      return
    }
    setSavingSender(true)
    setSenderError("")
    try {
      const res = await fetch("/api/email/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domain.id, from_email: `${box}@${domain.domain}`, from_name: fromName.trim(), reply_to: replyTo.trim(), is_default: true }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || "We couldn't save that address.")
      setDomain((prev) => (prev ? { ...prev, senders: [body.sender, ...(prev.senders || [])] } : prev))
      await queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Ready to send email")
    } catch (e: any) {
      setSenderError(e?.message || "We couldn't save that address.")
    } finally {
      setSavingSender(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      const res = await fetch("/api/onboarding/email-test", { method: "POST" })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || "We couldn't send a test right now.")
      toast.success(`Sent to ${body.to}. Check your inbox.`)
    } catch (e: any) {
      toast.error(e?.message || "We couldn't send a test right now.")
    } finally {
      setTesting(false)
    }
  }

  const sender = domain?.senders?.find((s) => s.is_default) ?? domain?.senders?.[0] ?? null
  const verified = domain?.status === "verified"

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div>
        <button type="button" onClick={() => router.push("/getting-started")} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to setup
        </button>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Email</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send email to buyers from your own domain so it lands in the inbox, not spam.</p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !domain ? (
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email-domain" className="text-sm font-semibold">
              What domain do you send email from?
            </Label>
            <Input id="email-domain" placeholder="everystatehousebuyers.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDomain()} />
            <p className="text-xs text-muted-foreground">Use the same domain as your website, like everystatehousebuyers.com. Gmail and Outlook addresses can&apos;t be used.</p>
          </div>
          <Button variant="brand" onClick={addDomain} disabled={adding || !domainInput.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Card>
      ) : !verified ? (
        <Card className="p-4 sm:p-5">
          <DnsAssistant kind="email" id={domain.id} domain={domain.domain} onAllOk={() => void verify()} />
        </Card>
      ) : !sender ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {domain.domain} is connected
          </div>
          <h2 className="text-base font-semibold text-foreground">Choose your from address</h2>
          <div className="space-y-1.5">
            <Label htmlFor="email-mailbox">From address</Label>
            <div className="flex items-center gap-1.5">
              <Input id="email-mailbox" className="max-w-[10rem]" value={mailbox} onChange={(e) => setMailbox(e.target.value)} />
              <span className="min-w-0 break-all text-sm text-muted-foreground">@{domain.domain}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-name">Display name</Label>
            <Input id="email-name" maxLength={100} value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder={defaults.name || "Your business name"} />
            <p className="text-xs text-muted-foreground">What buyers see as the sender.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-reply">Replies go to</Label>
            <Input id="email-reply" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="you@gmail.com" />
            <p className="text-xs text-muted-foreground">Any inbox you check, even a personal Gmail.</p>
          </div>
          {senderError ? <p className="text-sm text-destructive">{senderError}</p> : null}
          <Button variant="brand" onClick={addSender} disabled={savingSender || !mailbox.trim()}>
            {savingSender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Use this address
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4 p-5 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ready to send email</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              Buyers will get your emails from <span className="font-semibold text-foreground">{sender.from_email}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="brand" onClick={sendTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send a test email to yourself
            </Button>
            <Button variant="outline" onClick={() => router.push("/getting-started")}>
              Back to setup
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
