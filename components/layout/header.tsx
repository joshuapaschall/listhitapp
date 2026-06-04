"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Bell, Loader2, LogOut, Mail, Menu, MessageSquare, Phone, Search, Settings, User } from "lucide-react"

import { LogoutButton } from "@/components/auth/LogoutButton"
import { BuyerService } from "@/services/buyer-service"
import { formatPhoneDisplay } from "@/lib/dedup-utils"
import { cn } from "@/lib/utils"
import type { Buyer } from "@/lib/supabase"
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
import { PopoverAnchor } from "@radix-ui/react-popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/hooks/use-notifications"
import { useSession } from "@/hooks/use-session"
import { useCall } from "@/components/voice/CallProvider"
import SendEmailModal from "@/components/buyers/send-email-modal"
import SendSmsModal from "@/components/buyers/send-sms-modal"

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

const buyerLabel = (b: Buyer) =>
  b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"

const buyerInitials = (b: Buyer) => {
  const name = buyerLabel(b)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Header({ toggleSidebar }: HeaderProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Buyer[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchAnchorRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
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

  // Debounced buyer search (~250ms). Searches once the query is 2+ chars.
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    setSearchOpen(true)
    const timer = setTimeout(async () => {
      try {
        const rows = await BuyerService.searchBuyers(q)
        setSearchResults((rows || []).slice(0, 8))
        setActiveIndex(-1)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const goToBuyer = (id: string) => {
    router.push(`/inbox?buyerId=${id}`)
    setSearchQuery("")
    setSearchResults([])
    setSearchOpen(false)
    setActiveIndex(-1)
  }

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchOpen(false)
      return
    }
    if (!searchOpen || searchResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      goToBuyer(searchResults[activeIndex].id)
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        <Button variant="ghost" size="icon" className="mr-4 md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center space-x-4">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverAnchor asChild>
              <div ref={searchAnchorRef} className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  id="global-search"
                  name="global-search"
                  placeholder="Search buyers by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  className="pl-10"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={searchOpen}
                  aria-controls="global-search-results"
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              id="global-search-results"
              align="start"
              sideOffset={4}
              // Portaled to body so it's never clipped, and above the call widget (z-50).
              className="z-[60] overflow-hidden p-0"
              style={{ width: "var(--radix-popover-trigger-width)" }}
              // Keep keyboard focus in the input — don't let the popover steal it.
              onOpenAutoFocus={(e) => e.preventDefault()}
              // Don't treat clicks back into the search input (the anchor) as "outside".
              onInteractOutside={(e) => {
                if (searchAnchorRef.current?.contains(e.target as Node)) e.preventDefault()
              }}
            >
              <div role="listbox">
                {searchLoading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No matches</div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {searchResults.map((b, i) => {
                      const secondary = [formatPhoneDisplay(b.phone || "") || b.phone, b.email]
                        .filter(Boolean)
                        .join(" · ")
                      return (
                        <li key={b.id} role="option" aria-selected={i === activeIndex}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => goToBuyer(b.id)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2 text-left",
                              i === activeIndex ? "bg-muted" : "hover:bg-muted",
                            )}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-xs">{buyerInitials(b)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">{buyerLabel(b)}</div>
                              <div className="truncate text-xs text-muted-foreground">{secondary || "No contact info"}</div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={() => setSmsOpen(true)}>
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
      <SendSmsModal open={smsOpen} onOpenChange={setSmsOpen} buyer={null} />
    </header>
  )
}
