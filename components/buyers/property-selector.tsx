"use client"

import { useEffect, useState } from "react"
import { Command } from "@/components/ui/command"
import { Search, X, Home } from "lucide-react"
import type { Property } from "@/lib/supabase"
import PropertySuggestionList from "./property-suggestion-list"
import { PropertyService } from "@/services/property-service"

interface PropertySelectorProps {
  value: Property | null
  onChange: (property: Property | null) => void
  placeholder?: string
  disabled?: boolean
}

export default function PropertySelector({
  value = null,
  onChange,
  placeholder = "Search properties...",
  disabled = false,
}: PropertySelectorProps) {
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && properties.length === 0) {
      setLoading(true)
      PropertyService.listAllProperties()
        .then((data) =>
          setProperties(
            data.sort((a, b) =>
              (a.address ?? "").localeCompare(b.address ?? "", undefined, {
                sensitivity: "base",
              }),
            ),
          ),
        )
        .catch((err) => {
          console.error("Error fetching properties:", err)
          setProperties([])
        })
        .finally(() => setLoading(false))
    }
  }, [open, properties.length])

  const filtered = inputValue
    ? properties.filter((p) =>
        `${p.address} ${p.city ?? ""} ${p.state ?? ""} ${p.zip ?? ""}`
          .toLowerCase()
          .includes(inputValue.toLowerCase()),
      )
    : properties

  const handleSelect = (property: Property) => {
    onChange(property)
    setInputValue("")
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const label = (p: Property) =>
    `${p.address}${p.city ? `, ${p.city}` : ""}${p.state ? `, ${p.state}` : ""}`

  // Selected state: a clean chip with the address and an X to clear (returns to search).
  if (value) {
    return (
      <div className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5">
        <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label(value)}</span>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear selection"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex h-9 w-full items-center rounded-md border border-border bg-background px-2.5">
        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          disabled={disabled}
          // Open only on genuine user interaction — never from a programmatic/initial focus.
          onMouseDown={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setInputValue(e.target.value)
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          <Command className="overflow-visible bg-transparent" shouldFilter={false}>
            <PropertySuggestionList
              query={inputValue}
              suggestions={filtered}
              loading={loading}
              onSelect={handleSelect}
            />
          </Command>
        </div>
      )}
    </div>
  )
}
