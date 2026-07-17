"use client"

import { AlertTriangle, Loader2, Star, X } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ImageStatus = "processing" | "uploading" | "ready" | "error"

export interface ImageItem {
  id: string
  url?: string // absent while processing / on error
  isNew: boolean
  isFeatured: boolean
  label?: string
  status?: ImageStatus // undefined ⇒ treat as "ready" (existing saved images)
  error?: string
}

interface SortableImageGridProps {
  items: ImageItem[]
  onReorder: (items: ImageItem[]) => void
  onDelete: (id: string) => void
  onSetFeatured: (id: string) => void
}

interface SortableTileProps {
  item: ImageItem
  onDelete: (id: string) => void
  onSetFeatured: (id: string) => void
}

function SortableTile({ item, onDelete, onSetFeatured }: SortableTileProps) {
  const status: ImageStatus = item.status ?? "ready"
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Processing / uploading — skeleton, not draggable, no affordances.
  if (status === "processing" || status === "uploading") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative cursor-default overflow-hidden rounded-lg border bg-card"
      >
        <div className="flex h-28 w-full animate-pulse flex-col items-center justify-center gap-1 rounded-lg bg-muted px-2 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          {item.label && (
            <span className="max-w-[90%] truncate text-[10px] text-muted-foreground">{item.label}</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {status === "processing" ? "Processing" : "Uploading"}
          </span>
        </div>
      </div>
    )
  }

  // Error — dismissible only, not draggable.
  if (status === "error") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative cursor-default overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5"
      >
        <div className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg px-2 text-center">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {item.label && (
            <span className="max-w-[90%] truncate text-[10px] text-muted-foreground">{item.label}</span>
          )}
          {item.error && <span className="line-clamp-2 text-[10px] text-destructive">{item.error}</span>}
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-1.5 top-1.5 h-6 w-6"
          onClick={() => onDelete(item.id)}
          aria-label="Dismiss photo"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  // Ready — the original draggable tile.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative cursor-grab touch-none overflow-hidden rounded-lg border bg-card active:cursor-grabbing",
        item.isNew && "border-dashed border-brand/40",
        isDragging && "z-10 opacity-70 shadow-lg ring-2 ring-brand",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.label || "Property photo"}
        className={cn("h-28 w-full rounded-lg object-cover", item.isNew && "opacity-80")}
        draggable={false}
      />

      {item.isFeatured && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <Star className="h-2.5 w-2.5 fill-current" />
          Cover
        </span>
      )}

      {item.isNew && !item.isFeatured && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          New
        </span>
      )}

      {/* Delete — onPointerDown stops the drag sensor from swallowing the click */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute right-1.5 top-1.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(item.id)}
        aria-label="Delete photo"
      >
        <X className="h-3 w-3" />
      </Button>

      {!item.isNew && !item.isFeatured && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute bottom-1.5 right-1.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onSetFeatured(item.id)}
          title="Set as cover image"
          aria-label="Set as cover image"
        >
          <Star className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export default function SortableImageGrid({ items, onReorder, onDelete, onSetFeatured }: SortableImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  if (items.length === 0) return null

  // Only ready tiles are sortable — dnd-kit must never try to sort a skeleton.
  const sortableIds = items.filter((i) => (i.status ?? "ready") === "ready").map((i) => i.id)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <SortableTile key={item.id} item={item} onDelete={onDelete} onSetFeatured={onSetFeatured} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
