"use client"

import type React from "react"

import { useState } from "react"

import { Command, CommandInput } from "@/components/ui/command"
import LocationBadgeList from "./location-badge-list"
import LocationSuggestionList from "./location-suggestion-list"
import { useLocationSuggestions } from "./use-location-suggestions"

interface LocationSelectorProps {
  value: string[]
  onChange: (locations: string[]) => void
  placeholder?: string
  disabled?: boolean
}


export default function LocationSelector({
  value = [],
  onChange,
  placeholder = "Search or add locations...",
  disabled = false,
}: LocationSelectorProps) {
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const { suggestions, loading } = useLocationSuggestions(inputValue)

  const handleInputChange = (input: string) => {
    setInputValue(input)
  }

  // Alternative: Handle input change for libraries expecting (event: React.ChangeEvent<HTMLInputElement>)
  // const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const input = event.target.value
  //   setInputValue(input)
  //   if (input.length > 2) {
  //     debouncedFetch(input)
  //   } else {
  //     setSuggestions([])
  //   }
  // }

  const addLocation = (location: string) => {
    if (!value.includes(location)) {
      onChange([...value, location])
    }
    setInputValue("")
  }

  // Remove a location
  const removeLocation = (location: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((l) => l !== location))
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        <LocationBadgeList locations={value} onRemove={removeLocation} />
        <Command className="w-full relative overflow-visible">
          <CommandInput
            placeholder={value.length ? "" : placeholder}
            value={inputValue}
            onValueChange={handleInputChange}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(true)}
            className="border-0 focus:ring-0 p-0 h-8"
            disabled={disabled}
          />
          {open && inputValue.length > 1 && (
            <div className="absolute left-0 top-full z-10 w-full bg-popover border rounded-md shadow-md mt-1">
              <LocationSuggestionList
                query={inputValue}
                suggestions={suggestions}
                loading={loading}
                onSelect={addLocation}
              />
            </div>
          )}
        </Command>
      </div>
    </div>
  )
}
