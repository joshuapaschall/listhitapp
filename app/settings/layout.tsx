"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import MainLayout from "@/components/layout/main-layout"
import { Can } from "@/components/auth/Can"
import type { PermissionKey } from "@/lib/permissions/keys"
import { cn } from "@/lib/utils"

const navItems: Array<{ href: string; label: string; description: string; permission?: PermissionKey }> = [
  {
    href: "/settings/profile",
    label: "My Profile",
    description: "Your name, phone, and personal details",
  },
  {
    href: "/settings/organization",
    label: "Organization",
    description: "Business name, address, and website",
    permission: "settings.organization",
  },
  {
    href: "/settings/markets",
    label: "Markets",
    description: "Group your numbers and configure routing & voicemail",
    permission: "settings.markets",
  },
  {
    href: "/settings/templates/sms",
    label: "Message Templates",
    description: "Manage SMS, email, and quick-reply templates",
    permission: "settings.templates",
  },
  {
    href: "/settings/keywords",
    label: "Negative Keywords",
    description: "Filter out spammy or unwanted phrases",
  },
  {
    href: "/settings/email-domains",
    label: "Email Domains",
    description: "Verify sender domains and manage from-addresses",
    permission: "settings.email_domains",
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    description: "SendFox, Telnyx, Gmail, and other connected services",
    permission: "settings.integrations",
  },
  {
    href: "/settings/users",
    label: "Users",
    description: "Invite teammates and manage roles & permissions",
    permission: "users.manage",
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
              const link = (
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

              if (!item.permission) return link

              return (
                <Can key={item.href} permission={item.permission}>
                  {link}
                </Can>
              )
            })}
          </nav>
        </aside>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </MainLayout>
  )
}
