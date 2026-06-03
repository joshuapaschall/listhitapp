"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, X, Loader2 } from "lucide-react"
import type { Buyer } from "@/lib/supabase"
import { useBuyerSuggestions } from "./use-buyer-suggestions"

interface BuyerSelectorProps {
  value: Buyer | null
  onChange: (buyer: Buyer | null) => void
  placeholder?: string
  disabled?: boolean
}

const displayName = (b: Buyer) =>
  b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

const initialsOf = (s: string) =>
  s.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"

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

  // Selected state: a clean chip with the name and an X to clear (returns to search).
  if (value) {
    return (
      <div className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-2">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="text-[10px]">{initialsOf(displayName(value))}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{displayName(value)}</span>
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
          <div className="max-h-52 overflow-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching buyers...
              </div>
            ) : results.length > 0 ? (
              results.map((buyer) => {
                const secondary = buyer.email || buyer.phone || ""
                return (
                  <button
                    key={buyer.id}
                    type="button"
                    // Keep focus on the input (avoids the blur-close race) and select on click.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(buyer)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-xs">{initialsOf(displayName(buyer))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{displayName(buyer)}</div>
                      {secondary ? <div className="truncate text-xs text-muted-foreground">{secondary}</div> : null}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No buyers found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
