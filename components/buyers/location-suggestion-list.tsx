"use client"

import { Check, Loader2, MapPin } from "lucide-react"
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface LocationSuggestionListProps {
  query: string
  suggestions: string[]
  loading?: boolean
  onSelect: (location: string) => void
  selected?: string[]
  showCheck?: boolean
  className?: string
}

export default function LocationSuggestionList({
  query,
  suggestions,
  loading = false,
  onSelect,
  selected = [],
  showCheck = false,
  className = "",
}: LocationSuggestionListProps) {
  return (
    <CommandList className={cn("max-h-52 overflow-auto", className)}>
      {loading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2">Searching locations...</span>
        </div>
      ) : (
        <>
          <CommandGroup>
            {suggestions.map((suggestion) => (
              <CommandItem
                key={suggestion}
                value={suggestion}
                onSelect={() => onSelect(suggestion)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                  <span>{suggestion}</span>
                </div>
                {showCheck && (
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(suggestion) ? "opacity-100" : "opacity-0"
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
