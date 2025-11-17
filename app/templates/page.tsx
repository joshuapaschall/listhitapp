"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { TemplateService } from "@/services/template-service"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function TemplatesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => TemplateService.listTemplates(),
  })
  const templates = data || []
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return
    setDeleting(id)
    try {
      await TemplateService.deleteTemplate(id)
      queryClient.invalidateQueries({ queryKey: ["templates"] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Message Templates</h1>
          <Button asChild>
            <Link href="/templates/new">New Template</Link>
          </Button>
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
                      <Link href={`/templates/edit/${t.id}`}>Edit</Link>
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
    </MainLayout>
  )
}
