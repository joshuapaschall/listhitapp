"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandInput } from "@/components/ui/command"
import { X } from "lucide-react"
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
              a.address.localeCompare(b.address, undefined, {
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

  return (
    <div className="relative">
      <div className="flex items-center p-1 border rounded-md min-h-10 w-full">
        {value ? (
          <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
            {value.address}
            {value.city ? `, ${value.city}` : ""}
            {value.state ? `, ${value.state}` : ""}
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
                <PropertySuggestionList
                  query={inputValue}
                  suggestions={filtered}
                  loading={loading}
                  onSelect={handleSelect}
                />
              </div>
            )}
          </Command>
        )}
      </div>
    </div>
  )
}
