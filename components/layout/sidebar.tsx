"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  Inbox,
  Mail,
  Users,
  Building,
  DollarSign,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Phone,
  Target,
  UserCheck,
  Shield,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { countUnreadThreads } from "@/services/message-service"
import { countUnreadEmailThreads } from "@/services/gmail-supabase"
import { supabase } from "@/lib/supabase"
import AddBuyerModal from "@/components/buyers/add-buyer-modal"
import CreateOfferModal from "@/components/offers/CreateOfferModal"

const navigation = [
  {
    title: "Dashboard",
    icon: Home,
    href: "/dashboard",
    badge: null,
  },
  {
    title: "Inbox",
    icon: Inbox,
    items: [
      { title: "SMS Inbox", href: "/inbox" },
      { title: "Email Inbox", href: "/gmail" },
    ],
    badge: null,
  },
  {
    title: "Calls",
    icon: Phone,
    href: "/calls",
    badge: null,
  },
  {
    title: "Agents",
    icon: UserCheck,
    href: "/agents",
    badge: null,
  },
  {
    title: "Campaigns",
    icon: Target,
    href: "/campaigns",
    badge: null,
  },
  {
    title: "Buyers",
    icon: Users,
    href: "/",
    badge: null,
  },
  {
    title: "Properties",
    icon: Building,
    href: "/properties",
    badge: null,
  },
  {
    title: "Showings",
    icon: Calendar,
    href: "/showings",
    badge: null,
  },
  {
    title: "Offers",
    icon: DollarSign,
    href: "/offers",
    badge: null,
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/reports",
    badge: null,
  },
  {
    title: "Admin",
    icon: Shield,
    items: [
      { title: "Health", href: "/api/diag/health" },
    ],
    badge: null,
  },
]



interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false)
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false)
  const pathname = usePathname()
  const queryClient = useQueryClient()

  const { data: unreadSms } = useQuery({
    queryKey: ["unread-sms"],
    queryFn: countUnreadThreads,
  })

  const { data: unreadEmail } = useQuery({
    queryKey: ["unread-email"],
    queryFn: countUnreadEmailThreads,
  })

  useEffect(() => {
    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-sms"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "message_threads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-sms"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "email_threads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-email"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_threads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-email"] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Store collapsed state in localStorage
  useEffect(() => {
    const storedCollapsed = localStorage.getItem("sidebarCollapsed")
    if (storedCollapsed !== null) {
      setCollapsed(storedCollapsed === "true")
    }
  }, [])

  const toggleCollapsed = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    localStorage.setItem("sidebarCollapsed", String(newCollapsed))
  }

  const totalUnread = (unreadSms || 0) + (unreadEmail || 0)

  const quickActions = [
    { label: "Add Buyer", icon: Users, onClick: () => setShowAddBuyerModal(true) },
    { label: "Add Property", icon: Building, href: "/properties/add" },
    { label: "Schedule Showing", icon: Calendar, href: "/showings?new=1" },
    { label: "Create Offer", icon: DollarSign, onClick: () => setShowCreateOfferModal(true) },
  ]

  const navItems = navigation.map((item) => {
    if (item.title === "Inbox") {
      return {
        ...item,
        badge: totalUnread > 0 ? String(totalUnread) : null,
        items: item.items?.map((sub) => {
          if (sub.title === "SMS Inbox") {
            return {
              ...sub,
              badge: unreadSms && unreadSms > 0 ? String(unreadSms) : null,
            }
          }
          if (sub.title === "Email Inbox") {
            return {
              ...sub,
              badge: unreadEmail && unreadEmail > 0 ? String(unreadEmail) : null,
            }
          }
          return sub
        }),
      }
    }
    return item
  })

  return (
    <>
    <div
      className={cn(
        "sidebar-panel card-shadow sidebar-dark flex flex-col transition-all duration-300 overflow-y-auto h-full",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center border-b px-4 flex-shrink-0">
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className={cn(
            "group flex items-center gap-2 rounded-md px-1 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0",
            collapsed ? "mx-auto" : "",
          )}
        >
          <div className="h-8 w-8 rounded-md bg-transparent flex items-center justify-center">
            <Image
              src="/branch/icon.png"
              alt="ListHit"
              width={22}
              height={22}
              className="h-5 w-5"
            />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg text-foreground truncate">ListHit</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto", collapsed ? "mx-auto" : "")}
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 flex-shrink-0">
        {!collapsed && <h3 className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</h3>}
        <div className={cn("grid gap-2", collapsed ? "grid-cols-1" : "grid-cols-2")}>
          {quickActions.map((action) =>
            action.href ? (
              <Link key={action.label} href={action.href}>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full h-16 flex flex-col items-center justify-center gap-1 text-center",
                    collapsed ? "h-12 p-2" : "p-3",
                  )}
                  title={action.label}
                >
                  <action.icon className="h-4 w-4" />
                  {!collapsed && (
                    <span className="text-xs leading-tight">{action.label}</span>
                  )}
                </Button>
              </Link>
            ) : (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className={cn(
                  "w-full h-16 flex flex-col items-center justify-center gap-1 text-center",
                  collapsed ? "h-12 p-2" : "p-3",
                )}
                title={action.label}
              >
                <action.icon className="h-4 w-4" />
                {!collapsed && (
                  <span className="text-xs leading-tight">{action.label}</span>
                )}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-2 px-4 flex-1">
        {!collapsed && <h3 className="text-sm font-semibold text-muted-foreground mb-3">Navigation</h3>}
        <nav className="space-y-1">
          <Accordion type="single" collapsible>
            {navItems.map((item) => {
              const isActive = item.items
                ? item.items.some((sub) => pathname === sub.href)
                : pathname === item.href
              return item.items ? (
                <AccordionItem key={item.title} value={item.title} className="border-0">
                  <AccordionTrigger
                    className={cn(
                      buttonVariants({
                        variant: isActive ? "secondary" : "ghost",
                        className: cn(
                          "w-full justify-start",
                          collapsed ? "px-2" : "px-3",
                          isActive && "bg-muted font-medium",
                        ),
                      }),
                    )}
                    title={item.title}
                  >
                    <item.icon className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
                    {!collapsed && (
                      <>
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </AccordionTrigger>
                  {!collapsed && (
                    <AccordionContent className="pl-8 space-y-1">
                      {item.items.map((sub) => {
                        const subActive = pathname === sub.href
                        return (
                          <Link key={sub.href} href={sub.href}>
                            <Button
                              variant={subActive ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "w-full justify-start",
                                subActive && "bg-muted font-medium",
                              )}
                              title={sub.title}
                            >
                              <span>{sub.title}</span>
                              {sub.badge && (
                                <Badge variant="secondary" className="ml-auto">
                                  {sub.badge}
                                </Badge>
                              )}
                            </Button>
                          </Link>
                        )
                      })}
                    </AccordionContent>
                  )}
                </AccordionItem>
              ) : (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      collapsed ? "px-2" : "px-3",
                      isActive && "bg-muted font-medium",
                    )}
                    title={item.title}
                  >
                    <item.icon className={cn("h-5 w-5", collapsed ? "mx-auto" : "mr-3")} />
                    {!collapsed && (
                      <>
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
              )
            })}
          </Accordion>
        </nav>
      </div>

      {/* Recent Activity */}
      {!collapsed && (
        <div className="px-4 pb-4 border-t flex-shrink-0">
          <h3 className="text-sm font-bold text-primary mb-3">Recent Activity</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            <div className="p-2 rounded-lg bg-muted/70 text-sm">
              <div className="font-medium">New buyer inquiry</div>
              <div className="text-muted-foreground text-xs">John Smith - 2 min ago</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/70 text-sm">
              <div className="font-medium">Property showing scheduled</div>
              <div className="text-muted-foreground text-xs">123 Main St - 1 hour ago</div>
            </div>
          </div>
        </div>
      )}
    </div>
    <AddBuyerModal
      open={showAddBuyerModal}
      onOpenChange={setShowAddBuyerModal}
    />
    <CreateOfferModal
      open={showCreateOfferModal}
      onOpenChange={setShowCreateOfferModal}
    />
  </>
 )
}
