"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell, LogOut, Mail, Menu, MessageSquare, Phone, Search, Settings, User } from "lucide-react"

import { LogoutButton } from "@/components/auth/LogoutButton"
import { NotificationItem } from "@/components/notifications/notification-item"
import ThemeToggle from "@/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/hooks/use-notifications"
import { useSession } from "@/hooks/use-session"
import { useCall } from "@/components/voice/CallProvider"
import SendEmailModal from "@/components/buyers/send-email-modal"

interface HeaderProps {
  toggleSidebar: () => void
}

type CurrentProfile = {
  email: string | null
  full_name: string | null
  display_name: string | null
}

function getUserInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function Header({ toggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const { user } = useSession()
  const { openDialer } = useCall()
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/me")
      return response.ok ? ((await response.json()) as CurrentProfile) : null
    },
  })
  const profileName = profile?.display_name || profile?.full_name || null
  const userEmail = profile?.email ?? user?.email ?? null
  const initials = getUserInitials(profileName, userEmail)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        <Button variant="ghost" size="icon" className="mr-4 md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center space-x-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              id="global-search"
              name="global-search"
              placeholder="Search buyers, properties, deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={openDialer}>
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEmailOpen(true)}>
            <Mail className="h-4 w-4" />
          </Button>
          {mounted && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={() => {
                    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
                    if (unreadIds.length) void markAsRead(unreadIds)
                  }}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b p-3">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications yet</div>
                  ) : (
                    <div className="space-y-2 p-2">
                      {notifications.slice(0, 20).map((n) => (
                        <NotificationItem key={n.id} notification={n} compact />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
          <ThemeToggle />
          <LogoutButton variant="ghost" size="sm" className="hidden gap-1 sm:inline-flex">
            <LogOut className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Log out</span>
          </LogoutButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2" title="User menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>My Account</span>
                  {userEmail ? <span className="text-xs font-normal text-muted-foreground">{userEmail}</span> : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SendEmailModal open={emailOpen} onOpenChange={setEmailOpen} buyer={null} />
    </header>
  )
}
