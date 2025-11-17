"use client"

import { useState } from "react"
import { Command, CommandInput } from "@/components/ui/command"
import LocationBadgeList from "./location-badge-list"
import LocationSuggestionList from "./location-suggestion-list"
import { useLocationSuggestions } from "./use-location-suggestions"

interface LocationFilterSelectorProps {
  selectedLocations: string[]
  onChange: (locations: string[]) => void
  placeholder?: string
}

export default function LocationFilterSelector({
  selectedLocations,
  onChange,
  placeholder = "Search locations...",
}: LocationFilterSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const [open, setOpen] = useState(false)
  const { suggestions } = useLocationSuggestions(searchValue)

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
  }

  const toggleLocation = (location: string) => {
    if (selectedLocations.includes(location)) {
      onChange(selectedLocations.filter((l) => l !== location))
    } else {
      onChange([...selectedLocations, location])
    }
  }

  const removeLocation = (location: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedLocations.filter((l) => l !== location))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="relative space-y-2">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        <LocationBadgeList
          locations={selectedLocations}
          onRemove={removeLocation}
          onClearAll={clearAll}
        />
        <Command className="w-full relative overflow-visible">
          <CommandInput
            placeholder={selectedLocations.length ? "" : placeholder}
            value={searchValue}
            onValueChange={handleSearchChange}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(true)}
            className="border-0 focus:ring-0 p-0 h-8"
          />
          {open && searchValue.length > 1 && (
            <div className="absolute left-0 top-full z-10 w-full bg-popover border rounded-md shadow-md mt-1">
              <LocationSuggestionList
                query={searchValue}
                suggestions={suggestions}
                onSelect={toggleLocation}
                selected={selectedLocations}
                showCheck
              />
            </div>
          )}
        </Command>
      </div>
    </div>
  )
}

