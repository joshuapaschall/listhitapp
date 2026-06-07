"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { analyzeMessage, type CostAnalysis } from "@/lib/sms-cost-guard"
import { formatUsd } from "@/lib/sms-pricing"
import { TemplateService } from "@/services/template-service"
import type { TemplateRecord } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface TemplateAuditDialogProps {
  templates: TemplateRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}

interface FlaggedTemplate {
  t: TemplateRecord
  a: CostAnalysis
}

function SegPill({ segments, encoding, tone }: { segments: number; encoding: string; tone: "before" | "after" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "before"
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-green-500/10 text-green-600 dark:text-green-400",
      )}
    >
      {segments} seg · {encoding}
    </span>
  )
}

export default function TemplateAuditDialog({ templates, open, onOpenChange, onApplied }: TemplateAuditDialogProps) {
  const flagged = useMemo<FlaggedTemplate[]>(
    () =>
      templates
        .map((t) => ({ t, a: analyzeMessage(t.message || "") }))
        .filter((x) => x.a.canSave),
    [templates],
  )

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [emojiByTemplate, setEmojiByTemplate] = useState<Record<string, boolean>>({})
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyingAll, setApplyingAll] = useState(false)

  const estSavingsPer1k = formatUsd(
    flagged.reduce((sum, x) => sum + x.a.savingsPerRecipient, 0) * 1000,
  )

  const applyOne = async (item: FlaggedTemplate) => {
    const useNoEmoji = !!emojiByTemplate[item.t.id]
    const message = useNoEmoji ? item.a.optimizedNoEmoji : item.a.optimized
    setApplyingId(item.t.id)
    try {
      await TemplateService.updateTemplate(item.t.id, { message }, "sms")
      setAppliedIds((prev) => new Set(prev).add(item.t.id))
      onApplied()
    } finally {
      setApplyingId(null)
    }
  }

  const applyAll = async () => {
    setApplyingAll(true)
    try {
      for (const item of flagged) {
        if (appliedIds.has(item.t.id)) continue
        // Bulk apply is always lossless — never strips emoji.
        await TemplateService.updateTemplate(item.t.id, { message: item.a.optimized }, "sms")
        setAppliedIds((prev) => new Set(prev).add(item.t.id))
      }
      onApplied()
      onOpenChange(false)
    } finally {
      setApplyingAll(false)
    }
  }

  const remaining = flagged.filter((x) => !appliedIds.has(x.t.id)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Optimize SMS templates</DialogTitle>
          <DialogDescription>
            {flagged.length} of {templates.length} templates can be sent for less. Review each before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Templates flagged</p>
            <p className="text-2xl font-semibold text-foreground">{flagged.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Est. savings / 1k sends</p>
            <p className="text-2xl font-semibold text-foreground">{estSavingsPer1k}</p>
          </div>
        </div>

        <div className="space-y-2">
          {flagged.map((item) => {
            const applied = appliedIds.has(item.t.id)
            const useNoEmoji = !!emojiByTemplate[item.t.id]
            const after = useNoEmoji ? item.a.afterNoEmoji : item.a.after
            return (
              <div
                key={item.t.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={item.t.name}>
                  {item.t.name}
                </span>
                <SegPill segments={item.a.before.segments} encoding={item.a.before.encoding} tone="before" />
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SegPill segments={after.segments} encoding={after.encoding} tone="after" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyOne(item)}
                  disabled={applied || applyingId === item.t.id || applyingAll}
                >
                  {applied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Applied
                    </>
                  ) : applyingId === item.t.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
                {item.a.hasEmoji && !applied && (
                  <label className="flex w-full items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Switch
                      checked={useNoEmoji}
                      onCheckedChange={(v) =>
                        setEmojiByTemplate((prev) => ({ ...prev, [item.t.id]: v }))
                      }
                    />
                    Also remove emoji
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyingAll}>
            Not now
          </Button>
          <Button variant="brand" onClick={applyAll} disabled={applyingAll || remaining === 0}>
            {applyingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              `Apply all ${remaining}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
