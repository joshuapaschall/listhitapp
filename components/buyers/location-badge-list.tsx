"use client"

import React from "react"
import { MapPin, X } from "lucide-react"

interface LocationBadgeListProps {
  locations: string[]
  onRemove?: (location: string, e: React.MouseEvent) => void
  className?: string
}

export default function LocationBadgeList({
  locations,
  onRemove,
  className = "",
}: LocationBadgeListProps) {
  if (locations.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {locations.map((location) => (
        <span key={location} className="chip">
          <MapPin className="h-3 w-3" />
          {location}
          {onRemove && (
            <X className="h-3 w-3 cursor-pointer" onClick={(e) => onRemove(location, e)} />
          )}
        </span>
      ))}
    </div>
  )
}
