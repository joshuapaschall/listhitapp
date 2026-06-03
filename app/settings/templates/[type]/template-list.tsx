"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail, MessageSquare, Reply, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import type { TemplateSlug } from "../template-types"
import { templateNav, templateTypeConfig } from "../template-types"
import { TemplateService } from "@/services/template-service"
import { cn } from "@/lib/utils"

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.label}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Button asChild className="focus-visible:ring-[#10B981]">
          <Link href={`/settings/templates/${slug}/new`}>{config.cta}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/50 p-1">
        {templateNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              item.href.endsWith(slug)
                ? "bg-[#ECFDF5] text-[#047857]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
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
        <Card className="mx-auto max-w-2xl border-dashed bg-[#ECFDF5]/50">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="rounded-full bg-[#ECFDF5] p-3 text-[#059669]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">No templates yet</h2>
            <p className="text-sm text-muted-foreground">Create your first {config.singular.toLowerCase()} to speed up outreach.</p>
            <Button asChild className="focus-visible:ring-[#10B981]">
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

            return (
              <Card key={t.id} className="flex h-full flex-col overflow-hidden border-border/80 shadow-sm transition hover:shadow-md">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-base font-medium">{t.name}</h3>
                    <Badge variant="secondary" className="gap-1 whitespace-nowrap bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]">
                      <ChannelIcon className="h-3.5 w-3.5" />
                      {config.singular}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p className="line-clamp-4 whitespace-pre-wrap break-words">{preview}</p>
                  </div>
                </CardContent>
                <CardFooter className="justify-between border-t bg-muted/20">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/settings/templates/${slug}/edit/${t.id}`}>Edit</Link>
                  </Button>
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
