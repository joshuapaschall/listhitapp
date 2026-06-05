"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { analyzeMessage } from "@/lib/sms-cost-guard"
import { formatUsd } from "@/lib/sms-pricing"
import { cn } from "@/lib/utils"

interface SmsCostGuardProps {
  message: string
  onApply: (next: string) => void
  className?: string
}

export default function SmsCostGuard({ message, onApply, className }: SmsCostGuardProps) {
  const a = useMemo(() => analyzeMessage(message), [message])
  const [showChanges, setShowChanges] = useState(false)
  const [emojiAlso, setEmojiAlso] = useState(false)

  if (a.canSave) {
    const savings = emojiAlso ? a.savingsPerRecipientNoEmoji : a.savingsPerRecipient
    const segsAfter = emojiAlso ? a.afterNoEmoji.segments : a.after.segments
    const dropped = Math.max(0, a.before.segments - segsAfter)
    const pctCheaper = a.before.segments > 0 ? Math.round((dropped / a.before.segments) * 100) : 0
    const next = emojiAlso ? a.optimizedNoEmoji : a.optimized

    return (
      <div
        className={cn(
          "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm",
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="font-medium text-foreground">Costs more than it needs to</p>
              <p className="text-muted-foreground">
                This sends as {a.before.segments} segments. A safe fix drops it to {segsAfter}
                {pctCheaper > 0 ? ` — ${pctCheaper}% cheaper` : ""}, saving {formatUsd(savings)}/recipient.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="brand" size="sm" onClick={() => onApply(next)}>
                <Sparkles className="h-3.5 w-3.5" />
                Fix it
              </Button>
              <button
                type="button"
                onClick={() => setShowChanges((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Show changes
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showChanges && "rotate-180")} />
              </button>
            </div>

            {showChanges && a.issues.length > 0 && (
              <ul className="space-y-1">
                {a.issues.map((issue) => (
                  <li key={issue.type} className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{issue.label}:</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                      {issue.chars.join(" ")}
                    </span>
                    {issue.lossless ? (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                          {issue.replacement}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">(changes tone — your call)</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {a.hasEmoji && (
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={emojiAlso} onCheckedChange={setEmojiAlso} />
                <span className="text-xs text-muted-foreground">Remove emoji to drop another segment</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (a.nearBoundary) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Trim ~{a.nearBoundary.trimChars} characters to drop a segment and save{" "}
        {formatUsd(a.nearBoundary.savingsPerRecipient)}/recipient.
      </p>
    )
  }

  return null
}
