"use client"

import { useMemo } from "react"
import { Check, AlertTriangle, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { analyzePost, type SeoInput, type CheckStatus } from "@/lib/blog/seo-coach"

const GROUPS = ["Basics", "Content", "Links & media"] as const

function band(score: number): { label: string; text: string; bar: string } {
  if (score >= 80) return { label: "Looking good", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" }
  if (score >= 50) return { label: "Needs work", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" }
  return { label: "Poor", text: "text-red-600 dark:text-red-400", bar: "bg-red-500" }
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
  if (status === "warn") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
  return <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
}

// Calm, hollow marker for an untouched post — a checklist to complete, not a failing grade.
function NeutralDot() {
  return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden="true" />
}

export function SeoCoachPanel(props: SeoInput) {
  const result = useMemo(() => analyzePost(props), [props])
  const b = band(result.score)

  // Until the writer adds a title or any body text, stay neutral instead of
  // flashing a red "Poor" grade on a blank post.
  const hasBody = Boolean(props.bodyHtml && props.bodyHtml.replace(/<[^>]*>/g, "").trim().length > 0)
  const started = Boolean(props.title?.trim()) || hasBody

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">SEO coach</h2>

      {/* Score block */}
      <div className="mt-3">
        <div className="flex items-end gap-1.5">
          <span className={cn("text-3xl font-bold leading-none tabular-nums", started ? b.text : "text-muted-foreground")}>
            {started ? result.score : "—"}
          </span>
          <span className="pb-0.5 text-sm text-muted-foreground">/100</span>
          <span className={cn("ml-auto text-xs font-semibold", started ? b.text : "text-muted-foreground")}>
            {started ? b.label : "Let's get this ranking"}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", started ? b.bar : "bg-transparent")}
            style={{ width: started ? `${result.score}%` : "0%" }}
          />
        </div>
        {!started && <p className="mt-2 text-xs text-muted-foreground">As you write, these light up green.</p>}
      </div>

      {/* Checks grouped */}
      <div className="mt-4 space-y-4">
        {GROUPS.map((group) => {
          const rows = result.checks.filter((c) => c.group === group)
          if (rows.length === 0) return null
          return (
            <div key={group}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
              <ul className="mt-1.5 space-y-1.5">
                {rows.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    {started ? <StatusIcon status={c.status} /> : <NeutralDot />}
                    <div className="min-w-0">
                      <div className="text-sm text-foreground">{c.label}</div>
                      {started && c.hint && c.status !== "pass" ? (
                        <div className="text-xs text-muted-foreground">{c.hint}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
