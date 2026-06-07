"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Globe, ExternalLink, MoreHorizontal, Plus, Trash2, Upload, Undo2 } from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

interface SiteRow {
  id: string
  name: string
  slug: string
  status: string
}

export default function WebsitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toDelete, setToDelete] = useState<SiteRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sites")
      if (!res.ok) throw new Error("Failed to load websites")
      const { sites } = await res.json()
      setSites(sites || [])
    } catch (e: any) {
      toast.error(e?.message || "Failed to load websites")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const togglePublish = async (site: SiteRow) => {
    const unpublish = site.status === "published"
    try {
      const res = await fetch(`/api/sites/${site.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unpublish ? { unpublish: true } : {}),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(unpublish ? "Website unpublished" : "Website published")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status")
    }
  }

  const performDelete = async () => {
    if (!toDelete) return
    try {
      const res = await fetch(`/api/sites/${toDelete.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete website")
      toast.success("Website deleted")
      setToDelete(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete website")
      setToDelete(null)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Websites</h1>
            <p className="text-sm text-muted-foreground">Build and publish lead-capture sites for your audiences.</p>
          </div>
          <Button asChild variant="brand">
            <Link href="/websites/new">
              <Plus className="h-4 w-4" /> Create website
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardFooter>
                  <Skeleton className="h-9 w-20" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Card className="mx-auto max-w-xl border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="rounded-full bg-brand/10 p-3 text-brand">
                <Globe className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">No websites yet</h2>
              <p className="text-sm text-muted-foreground">
                Spin up a branded lead-capture site in a few minutes.
              </p>
              <Button asChild variant="brand">
                <Link href="/websites/new">
                  <Plus className="h-4 w-4" /> Create website
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => {
              const published = site.status === "published"
              const domain = `${site.slug}.listhit.io`
              return (
                <Card key={site.id} className="flex h-full flex-col">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-base font-medium">{site.name}</h3>
                      <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Draft"}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{domain}</p>
                  </CardHeader>
                  <CardContent className="flex-1" />
                  <CardFooter className="items-center justify-between gap-2 border-t bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/websites/${site.id}/edit`}>Edit</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/websites/${site.id}/analytics`}>Analytics</Link>
                      </Button>
                      {published && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`https://${domain}`} target="_blank" rel="noreferrer">
                            View <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Website options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => togglePublish(site)}>
                          {published ? (
                            <>
                              <Undo2 className="mr-2 h-4 w-4" /> Unpublish
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" /> Publish
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 dark:text-red-400"
                          onClick={() => setToDelete(site)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null)
        }}
        title="Delete website"
        description={`This permanently deletes "${toDelete?.name || ""}" and its pages. This can't be undone.`}
        actionText="Delete"
        destructive
        onConfirm={performDelete}
      />
    </MainLayout>
  )
}
