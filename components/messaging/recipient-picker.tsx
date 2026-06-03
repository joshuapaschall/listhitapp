"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDebounce } from "@/hooks/use-debounce"
import { BuyerService } from "@/services/buyer-service"
import type { Buyer } from "@/lib/supabase"

export interface RecipientValue {
  buyerId?: string
  value: string
  label?: string
}

interface RecipientPickerProps {
  mode: "email" | "phone"
  value: RecipientValue | null
  onChange: (next: RecipientValue | null) => void
  placeholder?: string
}

const buyerName = (b: Buyer) => b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

const initialsOf = (s: string) =>
  s.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"

// Basic validity checks for the freeform "Use …" affordance.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d()+\-.\s]{4,}$/

export default function RecipientPicker({ mode, value, onChange, placeholder }: RecipientPickerProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Buyer[]>([])
  const [searching, setSearching] = useState(false)
  const debounced = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mirror the Dialer's search: phone-looking queries search digit-stripped.
  useEffect(() => {
    let active = true
    const q = debounced.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const hasDigits = /\d/.test(q)
    BuyerService.searchBuyers(hasDigits ? q.replace(/\D/g, "") : q)
      .then((rows) => active && setResults(rows ?? []))
      .catch(() => active && setResults([]))
      .finally(() => active && setSearching(false))
    return () => {
      active = false
    }
  }, [debounced])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const typed = query.trim()
  const freeformValid = mode === "email" ? EMAIL_RE.test(typed) : PHONE_RE.test(typed)
  const showFreeform = freeformValid && results.length === 0 && !searching

  const pickBuyer = (b: Buyer) => {
    onChange({ buyerId: b.id, value: (mode === "email" ? b.email : b.phone) || "", label: buyerName(b) })
    setQuery("")
    setOpen(false)
  }

  const pickFreeform = () => {
    onChange({ value: typed })
    setQuery("")
    setOpen(false)
  }

  if (value) {
    const chipLabel = value.label || value.value
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="text-[10px]">
            {value.label ? initialsOf(value.label) : mode === "email" ? "@" : "#"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{chipLabel}</div>
          {value.label ? <div className="truncate font-mono text-xs text-muted-foreground">{value.value}</div> : null}
        </div>
        <button
          type="button"
          aria-label="Remove recipient"
          onClick={() => onChange(null)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || (mode === "email" ? "Search buyers or type an email" : "Search buyers or type a number")}
        className="pl-9 h-9"
        aria-label="Recipient"
      />
      {open && typed.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {searching ? <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div> : null}
          {results.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => pickBuyer(b)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs">{initialsOf(buyerName(b))}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{buyerName(b)}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {(mode === "email" ? b.email : b.phone) || (mode === "email" ? "No email" : "No phone")}
                </div>
              </div>
            </button>
          ))}
          {showFreeform ? (
            <button
              type="button"
              onClick={pickFreeform}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs text-brand">
                {mode === "email" ? "@" : "#"}
              </span>
              <span className="truncate text-sm">Use &quot;{typed}&quot;</span>
            </button>
          ) : null}
          {!searching && results.length === 0 && !showFreeform ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
