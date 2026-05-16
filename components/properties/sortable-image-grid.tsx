"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageItem {
  id: string;
  url: string;
  isNew: boolean;
  isFeatured: boolean;
  label?: string;
}

interface SortableImageGridProps {
  items: ImageItem[];
  onReorder: (items: ImageItem[]) => void;
  onDelete: (id: string) => void;
  onSetFeatured: (id: string) => void;
}

interface SortableImageCardProps {
  item: ImageItem;
  onDelete: (id: string) => void;
  onSetFeatured: (id: string) => void;
}

function SortableImageCard({ item, onDelete, onSetFeatured }: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card",
        item.isNew && "border-dashed border-blue-400",
        isDragging && "z-50 scale-105 opacity-90 shadow-xl",
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

      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-1 left-1/2 -translate-x-1/2 cursor-grab rounded-full bg-black/50 px-3 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 text-white" />
      </div>
    </div>
  );
}

export default function SortableImageGrid({ items, onReorder, onDelete, onSetFeatured }: SortableImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  if (items.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => (
            <SortableImageCard
              key={item.id}
              item={item}
              onDelete={onDelete}
              onSetFeatured={onSetFeatured}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
