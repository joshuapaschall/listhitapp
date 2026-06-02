"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { Filter, Mail, MessageSquare, MoreVertical, Pencil, Copy, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import MainLayout from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import SegmentBuilder from "@/components/segments/segment-builder"
import SegmentSummaryPills from "@/components/segments/segment-summary-pills"
import SegmentCountBadge from "@/components/segments/segment-count-badge"
import { SegmentService, type Segment } from "@/services/segment-service"
import { definitionNeedsCampaignContext, validateDefinition } from "@/lib/segments/resolver"
import { isConditionComplete } from "@/lib/segments/condition-utils"
import { usePermissions } from "@/hooks/use-permissions"
import type { SegmentDefinition } from "@/lib/segments/types"

const EMPTY_DEFINITION: SegmentDefinition = { match: "all", conditions: [] }

// UI channel value: "both" maps to a null channel column.
type ChannelChoice = "email" | "sms" | "both"
const toColumnChannel = (c: ChannelChoice): "email" | "sms" | null => (c === "both" ? null : c)
const toChoice = (c: "email" | "sms" | null): ChannelChoice => c ?? "both"
// A null channel segment is reachable on both; preview defaults to email.
const previewChannel = (c: "email" | "sms" | null): "email" | "sms" | "both" => c ?? "both"

interface EditorState {
  id: string | null
  name: string
  description: string
  channel: ChannelChoice
  definition: SegmentDefinition
}

const blankEditor = (): EditorState => ({
  id: null,
  name: "",
  description: "",
  channel: "both",
  definition: EMPTY_DEFINITION,
})

export default function SegmentsPage() {
  const queryClient = useQueryClient()
  const { can, isAdmin, loading: permsLoading } = usePermissions()
  const canView = isAdmin || can("buyers.view")
  const canEdit = isAdmin || can("buyers.edit")

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null)

  const { data: segments, isLoading } = useQuery({
    queryKey: ["segments"],
    queryFn: () => SegmentService.listSegments(),
    enabled: canView && !permsLoading,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["segments"] })

  const saveMutation = useMutation({
    mutationFn: async (state: EditorState) => {
      const input = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        channel: toColumnChannel(state.channel),
        definition: state.definition,
      }
      return state.id
        ? SegmentService.updateSegment(state.id, input)
        : SegmentService.createSegment(input)
    },
    onSuccess: () => {
      toast.success("Segment saved")
      setEditor(null)
      invalidate()
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save segment"),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => SegmentService.duplicateSegment(id),
    onSuccess: () => {
      toast.success("Segment duplicated")
      invalidate()
    },
    onError: (e: any) => toast.error(e?.message || "Failed to duplicate"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SegmentService.softDeleteSegment(id),
    onSuccess: () => {
      toast.success("Segment deleted")
      setDeleteTarget(null)
      invalidate()
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  })

  const saveValidation = useMemo(() => {
    if (!editor) return { ok: false, reason: "" }
    if (!editor.name.trim()) return { ok: false, reason: "Name is required" }
    try {
      validateDefinition(editor.definition)
    } catch (e: any) {
      return { ok: false, reason: e?.message || "Invalid conditions" }
    }
    // Block save if any condition is incomplete.
    const hasIncomplete = editor.definition.conditions.some((c) => !isConditionComplete(c))
    if (hasIncomplete) return { ok: false, reason: "Finish or remove incomplete conditions" }
    return { ok: true, reason: "" }
  }, [editor])

  if (!permsLoading && !canView) {
    return (
      <MainLayout>
        <div className="p-6">
          <p className="text-muted-foreground">You don&apos;t have permission to view segments.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Filter className="h-6 w-6 text-emerald-600" />
              Segments
            </h1>
            <p className="text-sm text-muted-foreground">
              Reusable, named audiences. Build once, reuse across campaigns.
            </p>
          </div>
          {canEdit && (
            <Button className="gap-1.5" onClick={() => setEditor(blankEditor())}>
              <Plus className="h-4 w-4" />
              New segment
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : !segments?.length ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No segments yet.</p>
            {canEdit && (
              <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setEditor(blankEditor())}>
                <Plus className="h-4 w-4" />
                Create your first segment
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {segments.map((seg) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                canEdit={canEdit}
                onEdit={() =>
                  setEditor({
                    id: seg.id,
                    name: seg.name,
                    description: seg.description ?? "",
                    channel: toChoice(seg.channel),
                    definition: seg.definition ?? EMPTY_DEFINITION,
                  })
                }
                onDuplicate={() => duplicateMutation.mutate(seg.id)}
                onDelete={() => setDeleteTarget(seg)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / edit sheet */}
      <Sheet open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editor?.id ? "Edit segment" : "New segment"}</SheetTitle>
            <SheetDescription>Define who belongs to this audience.</SheetDescription>
          </SheetHeader>

          {editor && (
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder="e.g. Cash buyers in Texas"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Channel</label>
                <Select
                  value={editor.channel}
                  onValueChange={(c) => setEditor({ ...editor, channel: c as ChannelChoice })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Email &amp; SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-4">
                <SegmentBuilder
                  value={editor.definition}
                  onChange={(definition) => setEditor({ ...editor, definition })}
                  channel={editor.channel}
                  allowThisCampaign={false}
                />
              </div>
            </div>
          )}

          <SheetFooter className="gap-2 border-t pt-4 sm:justify-between">
            {!saveValidation.ok && saveValidation.reason ? (
              <span className="text-xs text-amber-600">{saveValidation.reason}</span>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button
                disabled={!saveValidation.ok || saveMutation.isPending}
                onClick={() => editor && saveMutation.mutate(editor)}
              >
                {saveMutation.isPending ? "Saving…" : "Save segment"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmInputDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete segment"
        description={`This soft-deletes "${deleteTarget?.name ?? ""}". Campaigns that referenced it keep working.`}
        confirmationText={deleteTarget?.name ?? "delete"}
        actionText="Delete segment"
        onConfirm={async () => {
          if (deleteTarget) await deleteMutation.mutateAsync(deleteTarget.id)
        }}
      />
    </MainLayout>
  )
}

function channelBadge(channel: "email" | "sms" | null) {
  if (channel === "email") {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Mail className="h-3 w-3" /> Email
      </Badge>
    )
  }
  if (channel === "sms") {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <MessageSquare className="h-3 w-3" /> SMS
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Mail className="h-3 w-3" />
      <MessageSquare className="h-3 w-3" /> Email · SMS
    </Badge>
  )
}

function SegmentCard({
  segment,
  canEdit,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  segment: Segment
  canEdit: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const definition = segment.definition ?? EMPTY_DEFINITION
  const campaignSpecific = definitionNeedsCampaignContext(definition)

  return (
    <Card className="flex flex-col rounded-xl">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {channelBadge(segment.channel)}
            {campaignSpecific && (
              <Badge
                variant="outline"
                className="border-emerald-100 bg-emerald-50/60 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                Campaign-specific
              </Badge>
            )}
          </div>
          <h3 className="font-semibold leading-tight">{segment.name}</h3>
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Segment actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <SegmentSummaryPills definition={definition} />
        <div className="flex items-center justify-between gap-2">
          {campaignSpecific ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span className="tabular-nums">—</span>
              <span>Counts inside a campaign</span>
            </div>
          ) : (
            <SegmentCountBadge
              definition={definition}
              channel={previewChannel(segment.channel)}
            />
          )}
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(segment.updated_at), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
