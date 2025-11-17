"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { PromptService } from "@/services/prompt-service"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function PromptsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => PromptService.listPrompts(),
  })
  const prompts = data || []
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt?")) return
    setDeleting(id)
    try {
      await PromptService.deletePrompt(id)
      queryClient.invalidateQueries({ queryKey: ["prompts"] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Prompts</h1>
          <Button asChild>
            <Link href="/prompts/new">New Prompt</Link>
          </Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && prompts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No prompts found.</TableCell>
                </TableRow>
              )}
              {prompts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{p.description || ""}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/prompts/edit/${p.id}`}>Edit</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                    >
                      {deleting === p.id ? "Deleting..." : "Delete"}
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
