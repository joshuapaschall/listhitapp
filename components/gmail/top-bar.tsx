"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Search, SlidersHorizontal, RefreshCw, MoreVertical, ChevronLeft, ChevronRight, X } from "lucide-react"

interface TopBarProps {
  search: string
  onSearchChange: (value: string) => void
  isSearching?: boolean
  totalCount?: number
  pageStart?: number
  pageEnd?: number
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
}

export default function TopBar({ search, onSearchChange, isSearching, totalCount, pageStart, pageEnd, canPrev, canNext, onPrev, onNext }: TopBarProps) {
  const queryClient = useQueryClient()
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
    queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
  }
  const countLabel = typeof totalCount === "number" && totalCount > 0 ? `${(pageStart ?? 1).toLocaleString()}–${(pageEnd ?? 0).toLocaleString()} of ${totalCount.toLocaleString()}` : null

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
      <div className="flex max-w-3xl flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-4 py-2 transition-colors focus-within:bg-background focus-within:shadow-sm focus-within:ring-1 focus-within:ring-border">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input id="mail-search" name="mail-search" placeholder="Search mail" value={search} onChange={(e) => onSearchChange(e.target.value)} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {search.length > 0 && <button onClick={() => onSearchChange("")} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Clear search"><X className="h-4 w-4" /></button>}
        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Show search options"><SlidersHorizontal className="h-4 w-4" /></button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={handleRefresh} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
        {countLabel && <span className="hidden px-2 text-xs text-muted-foreground sm:inline">{countLabel}{isSearching ? " (search)" : ""}</span>}
        <button onClick={onPrev} disabled={!canPrev} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" title="Newer"><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={onNext} disabled={!canNext} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" title="Older"><ChevronRight className="h-4 w-4" /></button>
        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="More"><MoreVertical className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
