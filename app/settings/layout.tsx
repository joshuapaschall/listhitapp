"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import MainLayout from "@/components/layout/main-layout"
import { cn } from "@/lib/utils"

const navItems = [
  {
    href: "/settings/templates/sms",
    label: "Message Templates",
    description: "Manage SMS, email, and quick-reply templates",
  },
  {
    href: "/settings/domains",
    label: "Short Domains",
    description: "Manage the domains used for link tracking",
  },
  {
    href: "/settings/keywords",
    label: "Negative Keywords",
    description: "Filter out spammy or unwanted phrases",
  },
]

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <MainLayout>
      <div className="flex h-full">
        <aside className="w-72 border-r bg-muted/30">
          <div className="p-4">
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure messaging, domains, and safeguards
            </p>
          </div>
          <nav className="space-y-1 px-2 pb-4">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col rounded-md px-3 py-2 text-sm transition hover:bg-muted",
                    active
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </MainLayout>
  )
}
