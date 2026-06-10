"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Lock, Play, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  OnboardingStatus,
  OnboardingSection,
  OnboardingStepDef,
} from "@/lib/onboarding/steps"

// Mirror of the service's ResolvedStep / OnboardingState shapes. Defined locally
// so this presentational component never imports the server service (which pulls
// in the admin client).
export interface ResolvedStep extends OnboardingStepDef {
  status: OnboardingStatus
  locked: boolean
}
export interface OnboardingState {
  steps: ResolvedStep[]
  doneCount: number
  totalCount: number
  completed: boolean
}

function verbFor(key: string): string {
  if (key === "import_buyers") return "Import"
  if (key === "connect_gmail") return "Connect"
  return "Start"
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 56
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  const dash = c * pct
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="stroke-brand transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-foreground">
        {done}/{total}
      </div>
    </div>
  )
}

export function OnboardingChecklist({
  state,
  onChanged,
}: {
  state: OnboardingState
  onChanged: () => void
}) {
  const router = useRouter()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  async function post(key: string, status: "in_progress" | "skipped") {
    const res = await fetch(`/api/onboarding/steps/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || "Something went wrong")
    }
  }

  async function start(step: ResolvedStep) {
    if (step.locked) return
    setPendingKey(step.key)
    try {
      await post(step.key, "in_progress")
      onChanged()
      if (step.href) router.push(step.href)
    } catch {
      setPendingKey(null)
    }
  }

  async function skip(step: ResolvedStep) {
    setPendingKey(step.key)
    try {
      await post(step.key, "skipped")
      onChanged()
    } finally {
      setPendingKey(null)
    }
  }

  // Exactly one brand accent on screen: the first available (non-done, non-locked,
  // non-skipped) step.
  const primaryKey =
    state.steps.find((s) => s.status !== "done" && s.status !== "skipped" && !s.locked)?.key ?? null

  const inSection = (section: OnboardingSection) => state.steps.filter((s) => s.section === section)

  function Row({ step }: { step: ResolvedStep }) {
    const isDone = step.status === "done"
    const isSkipped = step.status === "skipped"
    const isLocked = step.locked
    const isPrimary = step.key === primaryKey
    const busy = pendingKey === step.key

    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3.5",
          isPrimary ? "border-l-2 border-l-brand border-border bg-card" : "border-border bg-card",
          (isDone || isLocked) && "bg-muted/30",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            isDone
              ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
              : isLocked
                ? "bg-muted text-muted-foreground"
                : "border border-border text-muted-foreground",
          )}
        >
          {isDone ? (
            <Check className="h-3.5 w-3.5" />
          ) : isLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                isDone || isLocked ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {step.label}
            </span>
            {isPrimary && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-fg">
                Start here
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDone ? (
            <span className="text-xs font-medium text-muted-foreground">
              {isSkipped ? "Skipped" : "Done"}
            </span>
          ) : isSkipped ? (
            <span className="text-xs font-medium text-muted-foreground">Skipped</span>
          ) : isLocked ? (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked
            </span>
          ) : (
            <>
              {step.optional && (
                <button
                  type="button"
                  onClick={() => skip(step)}
                  disabled={busy}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Skip for now
                </button>
              )}
              <Button
                type="button"
                size="sm"
                variant={isPrimary ? "brand" : "outline"}
                onClick={() => start(step)}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {verbFor(step.key)}
                    {isPrimary && <ArrowRight className="h-3.5 w-3.5" />}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header + progress ring */}
      <div className="flex items-center gap-4">
        <ProgressRing done={state.doneCount} total={state.totalCount} />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Let&apos;s get you set up</h1>
          <p className="text-sm text-muted-foreground">
            The texting approval takes a few days, so we start that first — then prep while it&apos;s in
            review.
          </p>
        </div>
      </div>

      {/* Tour banner (placeholder — wiring is a later task) */}
      <Card className="flex items-center gap-3 border-border p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Play className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">New to ListHit? See how it works</div>
          <p className="text-xs text-muted-foreground">A 2-minute tour before you dive in.</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled>
          Take the tour
        </Button>
      </Card>

      {/* Account — done rows */}
      <div className="space-y-2">
        {inSection("account").map((step) => (
          <Row key={step.key} step={step} />
        ))}
      </div>

      {/* Approval */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Start now — approval takes a few days
        </h2>
        {inSection("approval").map((step) => (
          <Row key={step.key} step={step} />
        ))}
      </div>

      {/* Prep */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          While you wait — get your account ready · no rush
        </h2>
        {inSection("prep").map((step) => (
          <Row key={step.key} step={step} />
        ))}
      </div>
    </div>
  )
}
