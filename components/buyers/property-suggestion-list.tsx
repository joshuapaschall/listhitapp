"use client"

import { Home, Loader2, Check } from "lucide-react"
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/supabase"

interface PropertySuggestionListProps {
  query: string
  suggestions: Property[]
  loading?: boolean
  onSelect: (property: Property) => void
  selected?: Property | null
  showCheck?: boolean
  className?: string
}

export default function PropertySuggestionList({
  query,
  suggestions,
  loading = false,
  onSelect,
  selected = null,
  showCheck = false,
  className = "",
}: PropertySuggestionListProps) {
  return (
    <CommandList className={cn("max-h-52 overflow-auto", className)}>
      {loading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2">Searching properties...</span>
        </div>
      ) : (
        <>
          <CommandGroup>
            {suggestions.map((property) => (
              <CommandItem
                key={property.id}
                value={property.id}
                onSelect={() => onSelect(property)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <Home className="h-4 w-4 mr-2 text-green-600" />
                  <span>
                    {property.address}
                    {property.city ? `, ${property.city}` : ""}
                    {property.state ? `, ${property.state}` : ""}
                  </span>
                </div>
                {showCheck && (
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected && selected.id === property.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
    </CommandList>
  )
}
