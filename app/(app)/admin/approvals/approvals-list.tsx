"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Loader2 } from "lucide-react"

import { Card } from "@/components/ui/card"

type QueueItem = {
  orgId: string
  orgName: string | null
  stage: string
  brandType: string | null
  submittedAt: string | null
  issues: Array<{ message: string }>
}

const STAGE_LABEL: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  action_required: "Action required",
  rejected: "Rejected",
  in_review: "In review (stuck)",
}

export function ApprovalsList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-approvals"],
    queryFn: async (): Promise<QueueItem[]> => {
      const res = await fetch("/api/admin/org-twilio/queue")
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to load")
      return body.items
    },
    refetchInterval: 60_000,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Texting approvals</h1>
        <p className="text-sm text-muted-foreground">Workspaces waiting on you, needing action, or stuck in review.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the queue.</p>
      ) : !data?.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nothing waiting. 🎉</Card>
      ) : (
        <div className="space-y-2">
          {data.map((item) => (
            <Link key={item.orgId} href={`/admin/approvals/${item.orgId}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{item.orgName || item.orgId}</div>
                <div className="text-xs text-muted-foreground">
                  {STAGE_LABEL[item.stage] ?? item.stage} · {item.brandType === "SOLE_PROPRIETOR" ? "Sole proprietor" : "Standard"}
                  {item.submittedAt ? ` · submitted ${new Date(item.submittedAt).toLocaleDateString()}` : ""}
                  {item.issues.length ? ` · ${item.issues.length} issue${item.issues.length === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
