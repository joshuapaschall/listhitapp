"use client"

import { Star, X } from "lucide-react"
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

interface SortableTileProps {
  item: ImageItem
  onDelete: (id: string) => void
  onSetFeatured: (id: string) => void
}

function SortableTile({ item, onDelete, onSetFeatured }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative cursor-grab touch-none overflow-hidden rounded-lg border bg-card active:cursor-grabbing",
        item.isNew && "border-dashed border-blue-400",
        isDragging && "z-10 opacity-70 shadow-lg ring-2 ring-blue-500",
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
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <SortableTile key={item.id} item={item} onDelete={onDelete} onSetFeatured={onSetFeatured} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
