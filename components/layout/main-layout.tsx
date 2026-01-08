"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  Home,
  Users,
  Building,
  DollarSign,
  Calendar,
  FileText,
  BarChart3,
  Target,
  Inbox,
} from "lucide-react"

const navigation = [
  {
    title: "Dashboard",
    icon: Home,
    href: "/dashboard",
    badge: null,
  },
  {
    title: "Buyers",
    icon: Users,
    href: "/",
    badge: "247",
  },
  {
    title: "Sellers",
    icon: Building,
    href: "/sellers",
    badge: "89",
  },
  {
    title: "Properties",
    icon: Home,
    href: "/properties",
    badge: "156",
  },
  {
    title: "Deals",
    icon: DollarSign,
    href: "/deals",
    badge: "23",
  },
  {
    title: "Showings",
    icon: Calendar,
    href: "/showings",
    badge: "5",
  },
  {
    title: "Campaigns",
    icon: Target,
    href: "/campaigns",
    badge: null,
  },
  {
    title: "Email",
    icon: Inbox,
    href: "/gmail",
    badge: null,
  },
  {
    title: "Documents",
    icon: FileText,
    href: "/documents",
    badge: null,
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/reports/deliverability",
    badge: null,
  },
]

const quickActions = [
  { label: "Add Buyer", icon: Users, action: "add-buyer" },
  { label: "Add Property", icon: Building, action: "add-property" },
  { label: "Create Deal", icon: DollarSign, action: "create-deal" },
  { label: "Schedule Showing", icon: Calendar, action: "schedule-showing" },
]

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default to closed
  const [searchQuery, setSearchQuery] = useState("")
  const [commandOpen, setCommandOpen] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Auto-open sidebar on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1536) {
        // 2xl breakpoint
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleAction = (action: string) => {
    switch (action) {
      case "schedule-showing":
        setShowScheduleModal(true)
        break
      default:
        break
    }
    setCommandOpen(false)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - responsive behavior */}
      <div className={`${sidebarOpen ? "block" : "hidden"} 2xl:block h-full`}>
        <Sidebar className="h-full" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 2xl:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 flex flex-col overflow-y-auto">{children}</main>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command" />
        <CommandList>
          {quickActions.map((qa) => (
            <CommandItem key={qa.action} onSelect={() => handleAction(qa.action)}>
              <qa.icon className="mr-2 h-4 w-4" /> {qa.label}
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>

      <ScheduleShowingModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
      />
    </div>
  )
}
