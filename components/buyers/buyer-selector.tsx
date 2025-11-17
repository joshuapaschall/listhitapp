"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"
import { X, User, Loader2 } from "lucide-react"
import type { Buyer } from "@/lib/supabase"
import { useBuyerSuggestions } from "./use-buyer-suggestions"

interface BuyerSelectorProps {
  value: Buyer | null
  onChange: (buyer: Buyer | null) => void
  placeholder?: string
  disabled?: boolean
}

export default function BuyerSelector({
  value = null,
  onChange,
  placeholder = "Search buyers...",
  disabled = false,
}: BuyerSelectorProps) {
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const { results, loading } = useBuyerSuggestions(inputValue, open)

  const handleSelect = (buyer: Buyer) => {
    onChange(buyer)
    setInputValue("")
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const displayName = (b: Buyer) =>
    b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

  return (
    <div className="relative">
      <div className="flex items-center p-1 border rounded-md min-h-10 w-full">
        {value ? (
          <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
            {displayName(value)}
            <X className="h-3 w-3 cursor-pointer" onClick={handleClear} />
          </Badge>
        ) : (
          <Command className="w-full relative overflow-visible">
            <CommandInput
              placeholder={placeholder}
              value={inputValue}
              onValueChange={setInputValue}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onFocus={() => setOpen(true)}
              className="border-0 focus:ring-0 p-0 h-8"
              disabled={disabled}
            />
            {open && (
              <div className="absolute left-0 top-full z-10 w-full bg-popover border rounded-md shadow-md mt-1">
                <CommandList className="max-h-52 overflow-auto">
                  {loading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2">Searching buyers...</span>
                    </div>
                  ) : results.length > 0 ? (
                    <CommandGroup>
                      {results.map((buyer) => (
                        <CommandItem
                          key={buyer.id}
                          value={buyer.id}
                          onSelect={() => handleSelect(buyer)}
                          className="flex items-center"
                        >
                          <User className="h-4 w-4 mr-2 text-green-600" />
                          <span>{displayName(buyer)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      No buyers found
                    </div>
                  )}
                </CommandList>
              </div>
            )}
          </Command>
        )}
      </div>
    </div>
  )
}
