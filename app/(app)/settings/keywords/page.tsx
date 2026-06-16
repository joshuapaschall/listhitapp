"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, Lock } from "lucide-react"
import { KeywordService } from "@/services/keyword-service"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/ui/confirm-dialog"
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
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await KeywordService.deleteKeyword(id)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Negative keywords</h1>
        <Button asChild variant="brand">
          <Link href="/settings/keywords/new">Add keyword</Link>
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p>
          <span className="font-medium text-foreground">Hide</span> tucks a matching reply into the Filtered tab and it
          returns if they message you again. <span className="font-medium text-foreground">DNC + hide</span> also stops
          future SMS sends to that contact. Carrier opt-out words (STOP, UNSUBSCRIBE…) are always handled automatically.
        </p>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead className="w-28">Match</TableHead>
              <TableHead className="w-32">On match</TableHead>
              <TableHead className="w-28">Source</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && keywords.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">No keywords found.</TableCell>
              </TableRow>
            )}
            {keywords.map((k) => {
              const system = k.is_system === true
              return (
                <TableRow key={k.id} className={system ? "opacity-70" : undefined}>
                  <TableCell className="font-medium">{k.keyword}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {k.match_type || "phrase"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {k.action === "dnc" ? (
                      <span className="inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                        DNC + hide
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Hide only
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {system ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        System
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Yours</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {system ? (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/settings/keywords/edit/${k.id}`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmId(k.id)}
                          disabled={deleting === k.id}
                        >
                          {deleting === k.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(o) => !o && setConfirmId(null)}
        destructive
        title="Delete keyword?"
        description="This can't be undone."
        actionText="Delete"
        onConfirm={async () => {
          if (confirmId) await handleDelete(confirmId)
        }}
      />
    </div>
  )
}
