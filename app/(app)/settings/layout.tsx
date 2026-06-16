"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  Filter,
  FilterX,
  Mail,
  MessageSquare,
  Radio,
  ShieldBan,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { Can } from "@/components/auth/Can"
import type { PermissionKey } from "@/lib/permissions/keys"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  permission?: PermissionKey
}

type NavSection = { label: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    label: "ACCOUNT",
    items: [
      {
        href: "/settings/profile",
        label: "My Profile",
        description: "Your name, phone, and personal details",
        icon: User,
      },
    ],
  },
  {
    label: "ORGANIZATION",
    items: [
      {
        href: "/settings/organization",
        label: "Organization",
        description: "Business name, address, and website",
        icon: Building2,
        permission: "settings.organization",
      },
      {
        href: "/settings/users",
        label: "Users",
        description: "Invite teammates and manage roles & permissions",
        icon: Users,
        permission: "users.manage",
      },
    ],
  },
  {
    label: "MESSAGING",
    items: [
      {
        href: "/settings/markets",
        label: "Markets",
        description: "Group your numbers and configure routing & voicemail",
        icon: Radio,
        permission: "settings.markets",
      },
      {
        href: "/settings/email-domains",
        label: "Email Domains",
        description: "Verify sender domains and manage from-addresses",
        icon: Mail,
        permission: "settings.email_domains",
      },
      {
        href: "/settings/templates/sms",
        label: "Message Templates",
        description: "Manage SMS, email, and quick-reply templates",
        icon: MessageSquare,
        permission: "settings.templates",
      },
    ],
  },
  {
    label: "AUDIENCE",
    items: [
      {
        href: "/settings/segments",
        label: "Segments",
        description: "Reusable, named audiences you reuse across campaigns",
        icon: Filter,
      },
    ],
  },
  {
    label: "SAFEGUARDS",
    items: [
      {
        href: "/settings/keywords",
        label: "Negative Keywords",
        description: "Filter out spammy or unwanted phrases",
        icon: FilterX,
      },
      {
        href: "/settings/dnc",
        label: "Do Not Contact",
        description: "Everyone who opted out by text, email, keyword, or that you added by hand.",
        icon: ShieldBan,
      },
    ],
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
          <nav className="px-2 pb-4">
            {navSections.map((section) => (
              <div key={section.label} className="mt-4 first:mt-0">
                <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = pathname.startsWith(item.href)
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition",
                          active
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
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
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </MainLayout>
  )
}
