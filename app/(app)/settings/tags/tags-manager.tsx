"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Lock,
  MoreHorizontal,
  Search,
  Tag as TagIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useInvalidateTagViews } from "@/hooks/use-org-tags"
import { cn } from "@/lib/utils"

type TagUsage = {
  id: string
  name: string
  color: string
  is_protected: boolean
  buyers: number
  properties: number
  segments: number
  created_at: string
}

const PALETTE = [
  "#3B82F6",
  "#16A34A",
  "#F59E0B",
  "#DC2626",
  "#8B5CF6",
  "#EC4899",
  "#0EA5E9",
  "#64748B",
  "#14B8A6",
  "#F97316",
]

type FilterChip = "all" | "custom" | "system" | "unused"
type SortKey = "name" | "buyers" | "properties" | "segments"

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
  { id: "system", label: "System" },
  { id: "unused", label: "Unused" },
]

/** "4 buyers, 2 properties and 1 segment" — used in every impact line. */
function impactPhrase(tag: TagUsage): string {
  const parts = [
    `${tag.buyers.toLocaleString()} ${tag.buyers === 1 ? "buyer" : "buyers"}`,
    `${tag.properties.toLocaleString()} ${tag.properties === 1 ? "property" : "properties"}`,
    `${tag.segments.toLocaleString()} ${tag.segments === 1 ? "segment" : "segments"}`,
  ]
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`
}

function ColorSwatches({
  value,
  onSelect,
  disabled,
}: {
  value: string
  onSelect: (color: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          aria-label={`Use color ${color}`}
          onClick={() => onSelect(color)}
          className={cn(
            "h-8 w-8 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50",
            value.toLowerCase() === color.toLowerCase()
              ? "border-foreground"
              : "border-transparent hover:border-foreground/30",
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

export default function TagsManager() {
  const invalidateTagViews = useInvalidateTagViews()
  const { data: tags = [], isLoading } = useQuery<TagUsage[]>({
    queryKey: ["settings-tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags/usage")
      if (!res.ok) throw new Error("Failed to load tags")
      return ((await res.json())?.tags ?? []) as TagUsage[]
    },
  })

  const [search, setSearch] = useState("")
  const [chip, setChip] = useState<FilterChip>("all")
  const [sortKey, setSortKey] = useState<SortKey>("buyers")
  const [sortDesc, setSortDesc] = useState(true)

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [renameTarget, setRenameTarget] = useState<TagUsage | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [colorTarget, setColorTarget] = useState<TagUsage | null>(null)
  const [mergeTarget, setMergeTarget] = useState<TagUsage | null>(null)
  const [mergeIntoId, setMergeIntoId] = useState("")
  const [mergeSearch, setMergeSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<TagUsage | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = tags.filter((tag) => {
      if (term && !tag.name.toLowerCase().includes(term)) return false
      if (chip === "custom" && tag.is_protected) return false
      if (chip === "system" && !tag.is_protected) return false
      if (chip === "unused" && tag.buyers + tag.properties > 0) return false
      return true
    })

    const dir = sortDesc ? -1 : 1
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir
      const diff = (a[sortKey] as number) - (b[sortKey] as number)
      // Stable, readable tie-break so equal counts don't shuffle.
      return diff !== 0 ? diff * dir : a.name.localeCompare(b.name)
    })
  }, [tags, search, chip, sortKey, sortDesc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((prev) => !prev)
      return
    }
    setSortKey(key)
    setSortDesc(key !== "name")
  }

  const closeDialogs = () => {
    setCreateOpen(false)
    setRenameTarget(null)
    setColorTarget(null)
    setMergeTarget(null)
    setDeleteTarget(null)
    setDialogError(null)
    setMergeIntoId("")
    setMergeSearch("")
    setDeleteConfirm("")
  }

  /**
   * One request helper for every mutation. On failure it keeps the dialog open
   * and surfaces the API's own message, which is where the useful detail is
   * ("A tag with that name already exists — use Merge instead.").
   */
  async function run(
    input: { url: string; method: string; body?: unknown },
    successMessage: string,
  ) {
    setPending(true)
    setDialogError(null)
    try {
      const res = await fetch(input.url, {
        method: input.method,
        headers: { "Content-Type": "application/json" },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDialogError(body?.error || "Something went wrong")
        return false
      }
      toast.success(successMessage)
      await invalidateTagViews()
      closeDialogs()
      return true
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Something went wrong")
      return false
    } finally {
      setPending(false)
    }
  }

  const mergeCandidates = useMemo(() => {
    if (!mergeTarget) return []
    const term = mergeSearch.trim().toLowerCase()
    return tags
      .filter((tag) => tag.id !== mergeTarget.id)
      .filter((tag) => !term || tag.name.toLowerCase().includes(term))
  }, [tags, mergeTarget, mergeSearch])

  const SortHeader = ({
    label,
    columnKey,
    className,
  }: {
    label: string
    columnKey: SortKey
    className?: string
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(columnKey)}
      className={cn("inline-flex items-center gap-1 hover:text-foreground", className)}
    >
      {label}
      {sortKey === columnKey &&
        (sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
    </button>
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">
            Your organization&apos;s tag list. Changes here update every buyer, property,
            segment, and draft campaign.
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => {
            closeDialogs()
            setNewName("")
            setNewColor(PALETTE[0])
            setCreateOpen(true)
          }}
        >
          New tag
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags…"
            className="pl-8"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {FILTER_CHIPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChip(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                chip === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <Card className="mx-auto max-w-2xl border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="rounded-full bg-brand/10 p-3 text-brand">
              <TagIcon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">No tags yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your first tag to start grouping buyers and properties.
            </p>
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              New tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader label="Tag" columnKey="name" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Buyers" columnKey="buyers" />
                </TableHead>
                {/* Hidden under 640px so the table stays usable on a phone. */}
                <TableHead className="hidden text-right sm:table-cell">
                  <SortHeader label="Properties" columnKey="properties" />
                </TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  <SortHeader label="Segments" columnKey="segments" />
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No tags match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color || PALETTE[0] }}
                        />
                        <span className="truncate font-medium">{tag.name}</span>
                        {tag.is_protected && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>System tag</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tag.buyers.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {tag.properties.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {tag.segments.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${tag.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!tag.is_protected && (
                            <DropdownMenuItem
                              onClick={() => {
                                closeDialogs()
                                setRenameValue(tag.name)
                                setRenameTarget(tag)
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              closeDialogs()
                              setColorTarget(tag)
                            }}
                          >
                            Change color
                          </DropdownMenuItem>
                          {!tag.is_protected && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  closeDialogs()
                                  setMergeTarget(tag)
                                }}
                              >
                                Merge into…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  closeDialogs()
                                  setDeleteTarget(tag)
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {tag.is_protected && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              System tags can&apos;t be renamed or deleted
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New tag */}
      <Dialog open={createOpen} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">Name</Label>
              <Input
                id="new-tag-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Cash Buyer"
                autoFocus
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorSwatches value={newColor} onSelect={setNewColor} disabled={pending} />
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={pending || !newName.trim()}
              onClick={() =>
                run(
                  { url: "/api/tags", method: "POST", body: { name: newName.trim(), color: newColor } },
                  "Tag created",
                )
              }
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
            {renameTarget && (
              <DialogDescription>
                This updates {impactPhrase(renameTarget)} and any draft campaigns.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-tag">Name</Label>
            <Input
              id="rename-tag"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              disabled={pending}
            />
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={pending || !renameValue.trim() || renameValue.trim() === renameTarget?.name}
              onClick={() =>
                renameTarget &&
                run(
                  {
                    url: `/api/tags/${renameTarget.id}`,
                    method: "PATCH",
                    body: { name: renameValue.trim() },
                  },
                  "Tag renamed",
                )
              }
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change color */}
      <Dialog open={!!colorTarget} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change color</DialogTitle>
            {colorTarget && <DialogDescription>{colorTarget.name}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2">
            <ColorSwatches
              value={colorTarget?.color ?? PALETTE[0]}
              disabled={pending}
              onSelect={(color) =>
                colorTarget &&
                run(
                  { url: `/api/tags/${colorTarget.id}`, method: "PATCH", body: { color } },
                  "Color updated",
                )
              }
            />
            {pending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </p>
            )}
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={pending}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge */}
      <Dialog open={!!mergeTarget} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into…</DialogTitle>
            {mergeTarget && (
              <DialogDescription>
                {impactPhrase(mergeTarget)} move to the chosen tag. &quot;{mergeTarget.name}&quot; is
                removed. Buyers who already have both keep one.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={mergeSearch}
                onChange={(event) => setMergeSearch(event.target.value)}
                placeholder="Search tags…"
                className="pl-8"
                disabled={pending}
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {mergeCandidates.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No other tags match.</p>
              ) : (
                mergeCandidates.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={pending}
                    onClick={() => setMergeIntoId(tag.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      mergeIntoId === tag.id ? "bg-primary/5 font-medium text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color || PALETTE[0] }}
                    />
                    <span className="truncate">{tag.name}</span>
                    {tag.is_protected && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  </button>
                ))
              )}
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={pending || !mergeIntoId}
              onClick={() =>
                mergeTarget &&
                run(
                  {
                    url: `/api/tags/${mergeTarget.id}/merge`,
                    method: "POST",
                    body: { targetId: mergeIntoId },
                  },
                  "Tags merged",
                )
              }
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete — typed confirmation, because the cascade is irreversible. */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            {deleteTarget && (
              <DialogDescription>
                This removes the tag from {impactPhrase(deleteTarget)} and any draft campaigns.
                Segment rules that only used this tag are dropped. This can&apos;t be undone.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Type <strong>{deleteTarget?.name}</strong> to continue.
            </p>
            <Input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteTarget?.name}
              autoFocus
              disabled={pending}
            />
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || deleteConfirm.trim() !== deleteTarget?.name}
              onClick={() =>
                deleteTarget &&
                run({ url: `/api/tags/${deleteTarget.id}`, method: "DELETE" }, "Tag deleted")
              }
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
