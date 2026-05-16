"use client"

import { GripVertical, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ImageItem {
  id: string
  url: string
  isNew: boolean
  isFeatured: boolean
  label?: string
}

interface SortableImageGridProps {
  items: ImageItem[]
  onReorder: (items: ImageItem[]) => void
  onDelete: (id: string) => void
  onSetFeatured: (id: string) => void
}

interface SortableImageCardProps {
  item: ImageItem
  onDelete: (id: string) => void
  onSetFeatured: (id: string) => void
  onMoveLeft: (id: string) => void
  onMoveRight: (id: string) => void
  canMoveLeft: boolean
  canMoveRight: boolean
}

function SortableImageCard({
  item,
  onDelete,
  onSetFeatured,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
}: SortableImageCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card",
        item.isNew && "border-dashed border-blue-400",
      )}
    >
      <img
        src={item.url}
        alt={item.label || "Property photo"}
        className={cn("h-28 w-full rounded-lg object-cover", item.isNew && "opacity-80")}
        draggable={false}
      />

      {item.isFeatured && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <Star className="h-2.5 w-2.5 fill-current" />
          Featured
        </span>
      )}

      {item.isNew && !item.isFeatured && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          New
        </span>
      )}

      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute right-1.5 top-1.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDelete(item.id)}
      >
        <X className="h-3 w-3" />
      </Button>

      {!item.isNew && !item.isFeatured && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-1.5 top-1.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onSetFeatured(item.id)}
          title="Set as featured image"
        >
          <Star className="h-3 w-3" />
        </Button>
      )}

      <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-white hover:bg-white/20"
          disabled={!canMoveLeft}
          onClick={() => onMoveLeft(item.id)}
          aria-label="Move image left"
        >
          <GripVertical className="h-3.5 w-3.5 rotate-90" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-white hover:bg-white/20"
          disabled={!canMoveRight}
          onClick={() => onMoveRight(item.id)}
          aria-label="Move image right"
        >
          <GripVertical className="h-3.5 w-3.5 -rotate-90" />
        </Button>
      </div>
    </div>
  )
}

export default function SortableImageGrid({ items, onReorder, onDelete, onSetFeatured }: SortableImageGridProps) {
  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return

    const nextItems = [...items]
    const [moved] = nextItems.splice(index, 1)
    nextItems.splice(nextIndex, 0, moved)
    onReorder(nextItems)
  }

  if (items.length === 0) return null

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item, index) => (
        <SortableImageCard
          key={item.id}
          item={item}
          onDelete={onDelete}
          onSetFeatured={onSetFeatured}
          onMoveLeft={() => moveItem(item.id, -1)}
          onMoveRight={() => moveItem(item.id, 1)}
          canMoveLeft={index > 0}
          canMoveRight={index < items.length - 1}
        />
      ))}
    </div>
  )
}
