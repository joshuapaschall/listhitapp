"use client"

import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface SidebarProps {
  folder: string
  onChange: (folder: string) => void
  onCompose: () => void
}

const folders = [
  "inbox",
  "starred",
  "snoozed",
  "important",
  "sent",
  "drafts",
  "trash",
]

const categories = ["Social", "Updates", "Forums"]
const labels = ["Personal", "Work"]

export default function Sidebar({ folder, onChange, onCompose }: SidebarProps) {
  return (
    <div className="hidden w-56 shrink-0 border-r p-4 space-y-2 sm:block">
      <Button
        onClick={onCompose}
        className="w-full rounded-full bg-primary text-primary-foreground"
      >
        Compose
      </Button>
      <div className="space-y-1">
        {folders.map((f) => (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${folder === f ? "bg-muted font-semibold" : ""}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <details className="group pt-2">
        <summary className="flex cursor-pointer items-center justify-between px-2 py-1 text-xs font-semibold">
          Categories
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 space-y-1 pl-4">
          {categories.map((c) => (
            <button
              key={c}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
            >
              {c}
            </button>
          ))}
        </div>
      </details>
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between px-2 py-1 text-xs font-semibold">
          Labels
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 space-y-1 pl-4">
          {labels.map((l) => (
            <button
              key={l}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
            >
              {l}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
