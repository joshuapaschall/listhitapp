"use client"

import Link from "next/link"
import { ArrowRight, Building2, Check, Globe, Mail, MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Outcome, OutcomeKey, SetupSummary } from "@/lib/onboarding/outcome-types"

// The setup hub: four outcomes (business, website, texting, email) derived from
// real data, plus the optional buyer import. One primary action — the
// recommended next outcome — and a live one-line status on every row.

export type { SetupSummary }

const ICONS: Record<OutcomeKey, typeof Building2> = {
  business: Building2,
  website: Globe,
  texting: MessageSquare,
  email: Mail,
  buyers: Users,
}

function StatePill({ outcome }: { outcome: Outcome }) {
  if (outcome.state === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Done
      </span>
    )
  }
  if (outcome.state === "in_review") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        In review
      </span>
    )
  }
  return null
}

function actionLabel(outcome: Outcome): string {
  if (outcome.state === "action_needed") return "Fix"
  if (outcome.state === "in_progress") return "Continue"
  return "Start"
}

export function SegmentedProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < done ? "bg-brand" : "bg-muted")} />
      ))}
    </div>
  )
}

function OutcomeRow({ outcome, recommended }: { outcome: Outcome; recommended: boolean }) {
  const Icon = ICONS[outcome.key]
  const showButton = outcome.state !== "ready" && outcome.state !== "in_review"
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4",
        recommended ? "border-brand/50 ring-1 ring-brand/20" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          outcome.ready ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : recommended ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">{outcome.title}</span>
          {recommended ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-fg">Next</span>
          ) : null}
        </div>
        <p className={cn("mt-0.5 text-xs leading-snug", outcome.state === "action_needed" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {outcome.status}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {outcome.state === "in_review" || outcome.state === "ready" ? (
          <Link href={outcome.href} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <StatePill outcome={outcome} />
          </Link>
        ) : null}
        {showButton ? (
          <Button asChild size="sm" variant={recommended ? "brand" : "outline"}>
            <Link href={outcome.href}>
              {actionLabel(outcome)}
              {recommended ? <ArrowRight className="h-3.5 w-3.5" /> : null}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function OnboardingChecklist({ state }: { state: SetupSummary }) {
  const required = state.outcomes.filter((o) => !o.optional)
  const buyers = state.outcomes.find((o) => o.key === "buyers")
  const texting = required.find((o) => o.key === "texting")
  const greeting = state.firstName ? `Welcome, ${state.firstName}` : "Welcome to ListHit"

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.allReady
            ? "You're all set. Everything is ready to go."
            : "Get these four things ready and you can reach every buyer by text, call and email."}
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">
            {state.readyCount} of {state.totalCount} ready
          </span>
          {texting?.state === "in_review" ? (
            <span className="text-xs text-muted-foreground">Texting is in carrier review · we&apos;ll email you</span>
          ) : null}
        </div>
        <SegmentedProgress done={state.readyCount} total={state.totalCount} />
      </Card>

      <div className="space-y-2.5">
        {required.map((o) => (
          <OutcomeRow key={o.key} outcome={o} recommended={o.key === state.recommended} />
        ))}
      </div>

      {buyers ? (
        <Link
          href={buyers.href}
          className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm transition-colors hover:bg-muted/40"
        >
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-foreground">Import your buyers</span>
            <span className="text-muted-foreground"> · {buyers.ready ? buyers.status : "Optional. Paste a few or upload a spreadsheet."}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {!state.allReady ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Texting review usually takes a few business days, so we suggest starting it before email. We&apos;ll email you at
          every step.
        </p>
      ) : null}
    </div>
  )
}
