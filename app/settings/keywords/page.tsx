"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { KeywordService } from "@/services/keyword-service"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function KeywordsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["keywords"],
    queryFn: () => KeywordService.listKeywords(),
  })
  const keywords = data || []
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this keyword?")) return
    setDeleting(id)
    try {
      await KeywordService.deleteKeyword(id)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Negative Keywords</h1>
          <Button asChild>
            <Link href="/settings/keywords/new">Add Keyword</Link>
          </Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={2}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && keywords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>No keywords found.</TableCell>
                </TableRow>
              )}
              {keywords.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.keyword}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/settings/keywords/edit/${k.id}`}>Edit</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(k.id)}
                      disabled={deleting === k.id}
                    >
                      {deleting === k.id ? "Deleting..." : "Delete"}
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
