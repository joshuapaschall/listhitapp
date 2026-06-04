"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TemplateService } from "@/services/template-service"
import type { TemplateRecord, TemplateType } from "@/lib/supabase"

interface TemplatePickerProps {
  type: TemplateType
  trigger: ReactNode
  onSelect: (template: TemplateRecord) => void
  onNew?: () => void
  manageHref?: string
  resolvePreview?: (message: string) => string
}

// The body fetches when it mounts — i.e. when the popover opens — so the network
// call is lazy and the search field only exists while the picker is open.
function PickerBody({
  type,
  onChoose,
  onNew,
  manageHref,
  resolvePreview,
}: {
  type: TemplateType
  onChoose: (t: TemplateRecord) => void
  onNew?: () => void
  manageHref?: string
  resolvePreview?: (message: string) => string
}) {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    TemplateService.listTemplates(type)
      .then((list) => {
        if (active) setTemplates(list || [])
      })
      .catch(() => {
        if (active) setTemplates([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [type])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? templates.filter(
        (t) => (t.name || "").toLowerCase().includes(q) || (t.message || "").toLowerCase().includes(q),
      )
    : templates

  const previewOf = (t: TemplateRecord) => {
    const raw = resolvePreview ? resolvePreview(t.message || "") : t.message || ""
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates"
          aria-label="Search templates"
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q ? "No matches." : "No templates yet."}
          </div>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChoose(t)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="w-full truncate text-sm font-medium text-foreground">{t.name}</span>
              <span className="w-full truncate text-xs text-muted-foreground">{previewOf(t) || "No content"}</span>
            </button>
          ))
        )}
      </div>

      {(onNew || manageHref) && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
          {onNew ? (
            <button type="button" onClick={onNew} className="font-medium text-brand hover:underline">
              New…
            </button>
          ) : (
            <span />
          )}
          {manageHref ? (
            <Link href={manageHref} className="text-muted-foreground hover:text-foreground">
              Manage
            </Link>
          ) : null}
        </div>
      )}
    </>
  )
}

export default function TemplatePicker({
  type,
  trigger,
  onSelect,
  onNew,
  manageHref,
  resolvePreview,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <PickerBody
          type={type}
          resolvePreview={resolvePreview}
          onChoose={(t) => {
            setOpen(false)
            onSelect(t)
          }}
          onNew={
            onNew
              ? () => {
                  setOpen(false)
                  onNew()
                }
              : undefined
          }
          manageHref={manageHref}
        />
      </PopoverContent>
    </Popover>
  )
}
