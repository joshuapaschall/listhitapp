"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { MapPin, X } from "lucide-react"

interface LocationBadgeListProps {
  locations: string[]
  onRemove?: (location: string, e: React.MouseEvent) => void
  onClearAll?: () => void
  className?: string
}

export default function LocationBadgeList({
  locations,
  onRemove,
  onClearAll,
  className = "",
}: LocationBadgeListProps) {
  if (locations.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {locations.map((location) => (
        <span
          key={location}
          className="chip chip-blue flex items-center gap-1"
        >
          <MapPin className="h-3 w-3" />
          {location}
          {onRemove && (
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={(e) => onRemove(location, e)}
            />
          )}
        </span>
      ))}
      {onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
