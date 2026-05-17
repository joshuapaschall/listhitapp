"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Search, SlidersHorizontal, RefreshCw, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react"

interface TopBarProps {
  search: string
  onSearchChange: (value: string) => void
  totalCount?: number
  pageStart?: number
  pageEnd?: number
}

export default function TopBar({ search, onSearchChange, totalCount, pageStart, pageEnd }: TopBarProps) {
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
    queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
  }

  const countLabel = totalCount && pageStart && pageEnd ? `${pageStart}–${pageEnd} of ${totalCount}` : null

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
      <div className="flex max-w-3xl flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-4 py-2 transition-colors focus-within:bg-background focus-within:shadow-sm focus-within:ring-1 focus-within:ring-border">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          id="mail-search"
          name="mail-search"
          placeholder="Search mail"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Show search options">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={handleRefresh} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>

        {countLabel && <span className="hidden px-2 text-xs text-muted-foreground sm:inline">{countLabel}</span>}

        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" title="Newer" disabled>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" title="Older" disabled>
          <ChevronRight className="h-4 w-4" />
        </button>

        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="More">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
