"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail, MessageSquare, Reply, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import type { TemplateSlug } from "../template-types"
import { templateNav, templateTypeConfig } from "../template-types"
import { TemplateService } from "@/services/template-service"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { cn } from "@/lib/utils"

// Split a preview string so {{merge_tokens}} can be rendered as brand chips.
const TOKEN_SPLIT = /(\{\{\s*\w+\s*\}\})/g
const ONE_TOKEN = /^\{\{\s*\w+\s*\}\}$/

function renderPreview(text: string) {
  return text.split(TOKEN_SPLIT).map((part, i) =>
    ONE_TOKEN.test(part) ? (
      <span key={i} className="mx-0.5 rounded bg-brand/10 px-1 py-0.5 text-xs font-medium text-brand">
        {part.replace(/[{}]/g, "").trim()}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function TemplateList({ slug }: { slug: TemplateSlug }) {
  const config = templateTypeConfig[slug]
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["templates", config.type],
    queryFn: () => TemplateService.listTemplates(config.type),
  })
  const templates = data || []
  const [deleting, setDeleting] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null)

  const handleDelete = async () => {
    if (!templateToDelete) return
    setDeleting(templateToDelete.id)
    try {
      await TemplateService.deleteTemplate(templateToDelete.id, config.type)
      await queryClient.invalidateQueries({ queryKey: ["templates", config.type] })
    } finally {
      setDeleting(null)
      setTemplateToDelete(null)
    }
  }

  const getPreview = (message: string) => {
    const cleaned = message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    if (!cleaned) return "No preview available yet."
    return cleaned.slice(0, 80) + (cleaned.length > 80 ? "..." : "")
  }

  const channelIcon = slug === "email" ? Mail : slug === "quick-reply" ? Reply : MessageSquare
  const isSms = config.type === "sms"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Button asChild variant="brand">
          <Link href={`/settings/templates/${slug}/new`}>{config.cta}</Link>
        </Button>
      </div>

      {/* Channel toggle — segmented control */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {templateNav.map((item) => {
          const active = item.href.endsWith(slug)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden border-border">
              <CardHeader className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-16" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="mx-auto max-w-2xl border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="rounded-full bg-brand/10 p-3 text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">No templates yet</h2>
            <p className="text-sm text-muted-foreground">Create your first {config.singular.toLowerCase()} to speed up outreach.</p>
            <Button asChild variant="brand">
              <Link href={`/settings/templates/${slug}/new`}>{config.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const ChannelIcon = channelIcon
            const preview = slug === "email"
              ? `${t.subject?.trim() ? `${t.subject.trim()} — ` : ""}${getPreview(t.message)}`
              : getPreview(t.message)
            const sms = isSms ? calculateSmsSegments(t.message || "") : null

            return (
              <Card key={t.id} className="flex h-full flex-col overflow-hidden border-border shadow-sm transition hover:shadow-md">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-base font-medium text-foreground">{t.name}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      <ChannelIcon className="h-3.5 w-3.5" />
                      {config.singular}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p className="line-clamp-3 whitespace-pre-wrap break-words">{renderPreview(preview)}</p>
                  </div>
                </CardContent>
                <CardFooter className="items-center justify-between gap-2 border-t border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/settings/templates/${slug}/edit/${t.id}`}>Edit</Link>
                    </Button>
                    {sms ? (
                      <span className="text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{sms.segments} seg</span>
                        <span className="ml-1.5">{(t.message || "").length} chars</span>
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setTemplateToDelete({ id: t.id, name: t.name })}
                    disabled={deleting === t.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {deleting === t.id ? "Deleting..." : "Delete"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmInputDialog
        open={!!templateToDelete}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null)
        }}
        title="Delete template"
        description={`This will permanently delete \"${templateToDelete?.name || ""}\".`}
        confirmationText="delete"
        actionText="Delete"
        onConfirm={handleDelete}
      />
    </div>
  )
}
