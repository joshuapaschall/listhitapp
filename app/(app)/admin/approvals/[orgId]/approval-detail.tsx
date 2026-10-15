"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, ExternalLink, FlaskConical, Loader2, RefreshCw, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export type ApprovalView = {
  orgId: string
  workspace: string
  businessName: string
  legalName: string
  entityType: string
  businessType: string
  einLast4: string
  address: string
  website: { url: string | null; privacyUrl: string | null; termsUrl: string | null; privacyOk: boolean; termsOk: boolean }
  rep: { name: string; title: string; email: string; phone: string }
  desiredNumber: string
  phoneNumber: string
  mock: boolean
  hasBrand: boolean
  stage: string
  spendApprovedAt: string | null
  issues: string[]
  cost: string
  brandType: string
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2.5 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-foreground">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
}

function Loads({ ok, label, url }: { ok: boolean; label: string; url: string | null }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
      {label}
    </a>
  )
}

export function ApprovalDetail({ view }: { view: ApprovalView }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function call(action: "approve" | "mock" | "advance", body: Record<string, unknown> = {}) {
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/org-twilio/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: view.orgId, ...body }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Request failed")
      toast.success(action === "approve" ? `Approved — now ${json.stage}` : action === "mock" ? "Test mode on" : `Re-checked — ${json.stage}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || "Request failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <Link href="/admin/approvals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All approvals
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{view.businessName || view.workspace}</h1>
        <p className="text-sm text-muted-foreground">
          {view.workspace} · stage <span className="font-mono">{view.stage}</span>
          {view.mock ? " · test mode" : ""}
        </p>
      </div>

      <Card className="divide-y px-4">
        <Row label="Legal name">{view.legalName}</Row>
        <Row label="Type">
          {view.brandType} · {view.entityType}
          {view.businessType ? ` · ${view.businessType}` : ""}
        </Row>
        <Row label="EIN">{view.einLast4 ? `ending ${view.einLast4}` : ""}</Row>
        <Row label="Address">{view.address}</Row>
        <Row label="Website">
          {view.website.url ? (
            <div className="space-y-1">
              <a href={view.website.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                {view.website.url} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="flex gap-3">
                <Loads ok={view.website.privacyOk} label="Privacy" url={view.website.privacyUrl} />
                <Loads ok={view.website.termsOk} label="Terms" url={view.website.termsUrl} />
              </div>
            </div>
          ) : (
            <span className="text-destructive">No compliant website</span>
          )}
        </Row>
        <Row label="Rep">
          {[view.rep.name, view.rep.title, view.rep.email, view.rep.phone].filter(Boolean).join(" · ")}
        </Row>
        <Row label="Number">{view.phoneNumber ? `${view.phoneNumber} (owned)` : view.desiredNumber}</Row>
        <Row label="Est. carrier cost">{view.cost}</Row>
        <Row label="Approved">{view.spendApprovedAt ? new Date(view.spendApprovedAt).toLocaleString() : "Not yet"}</Row>
        {view.issues.length ? (
          <Row label="Issues">
            <ul className="list-disc space-y-1 pl-4">
              {view.issues.map((i, n) => (
                <li key={n}>{i}</li>
              ))}
            </ul>
          </Row>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="brand" onClick={() => call("approve")} disabled={Boolean(busy) || Boolean(view.spendApprovedAt)}>
          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {view.spendApprovedAt ? "Approved" : "Approve"}
        </Button>
        <Button variant="outline" onClick={() => call("mock", { mock: true })} disabled={Boolean(busy) || view.hasBrand || view.mock}>
          {busy === "mock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {view.mock ? "Test mode is on" : "Turn on test mode"}
        </Button>
        <Button variant="ghost" onClick={() => call("advance")} disabled={Boolean(busy)}>
          {busy === "advance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-check now
        </Button>
      </div>
    </div>
  )
}
