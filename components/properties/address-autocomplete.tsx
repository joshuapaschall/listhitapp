"use client"

import { useState, useEffect } from "react"
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"
import { MapPin, Loader2 } from "lucide-react"
import { useAddressSuggestions, AddressSuggestion } from "./use-address-suggestions"
import { cn } from "@/lib/utils"

interface AddressAutocompleteProps {
  value: { address: string; city: string; state: string; zip: string }
  onSelect: (value: AddressSuggestion) => void
  placeholder?: string
  className?: string
}

export default function AddressAutocomplete({
  value,
  onSelect,
  placeholder = "Search address...",
  className = "",
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value.address)
  const [open, setOpen] = useState(false)
  const { suggestions, loading } = useAddressSuggestions(query, open)

  useEffect(() => {
    setQuery(value.address)
  }, [value.address])

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelect(suggestion)
    setQuery(suggestion.label)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <Command className="w-full relative overflow-visible">
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onFocus={() => setOpen(true)}
          className="border-0 focus:ring-0 p-0 h-8"
        />
        {open && query.length > 2 && (
          <div className="absolute left-0 top-full z-10 w-full bg-popover border rounded-md shadow-md mt-1">
            <CommandList className="max-h-52 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Searching addresses...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <CommandGroup>
                  {suggestions.map((s) => (
                    <CommandItem
                      key={`${s.latitude}-${s.longitude}`}
                      value={s.label}
                      onSelect={() => handleSelect(s)}
                      className="flex items-center"
                    >
                      <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{s.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">No results</div>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  )
}

