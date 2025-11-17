"use client"

import { Input } from "@/components/ui/input"

interface TopBarProps {
  search: string
  onSearchChange: (value: string) => void
}

export default function TopBar({ search, onSearchChange }: TopBarProps) {
  return (
    <div className="sticky top-0 z-10 flex h-12 items-center border-b bg-background px-4">
      <Input
        id="mail-search"
        name="mail-search"
        placeholder="Search mail"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full max-w-lg"
      />
    </div>
  )
}
