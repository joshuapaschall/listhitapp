"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronDown } from "lucide-react"

interface KPISectionProps {
  title: string
  children: ReactNode
  icon?: LucideIcon
  shade?: "odd" | "even"
}

export default function KPISection({ title, children, icon: Icon, shade = "odd" }: KPISectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const bg = shade === "even" ? "bg-muted/50" : "bg-muted"

  return (
    <div className={`rounded-md p-4 ${collapsed ? "" : "space-y-2"} ${bg}`}>
      <h2>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-2 text-left text-lg font-semibold"
        >
          {Icon && <Icon className="h-5 w-5" />}
          {title}
          <ChevronDown
            className={`ml-auto h-4 w-4 transition-transform ${collapsed ? "rotate-180" : "rotate-0"}`}
          />
        </button>
      </h2>
      {!collapsed && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {children}
        </div>
      )}
    </div>
  )
}
