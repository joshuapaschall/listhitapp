"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return
    setDeleting(id)
    try {
      await TemplateService.deleteTemplate(id, config.type)
      queryClient.invalidateQueries({ queryKey: ["templates", config.type] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{config.label}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Button asChild>
          <Link href={`/settings/templates/${slug}/new`}>{config.cta}</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {templateNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              item.href.endsWith(slug)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>No templates found.</TableCell>
              </TableRow>
            )}
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="whitespace-pre-wrap">
                  {t.message.slice(0, 50)}{t.message.length > 50 ? "..." : ""}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/settings/templates/${slug}/edit/${t.id}`}>
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                  >
                    {deleting === t.id ? "Deleting..." : "Delete"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
