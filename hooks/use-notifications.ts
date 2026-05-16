"use client"

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase, type Notification } from "@/lib/supabase"

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (ids: string[]) => Promise<void>
  dismiss: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Failed to fetch notifications")
      return res.json() as Promise<Notification[]>
    },
    refetchInterval: 60_000,
    enabled: mounted,
  })

  useEffect(() => {
    if (!mounted) return

    const channel = supabase
      .channel("notifications:realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [mounted, queryClient])

  const visible = notifications.filter((n) => !n.dismissed_at)
  const unreadCount = visible.filter((n) => !n.read_at).length

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    [queryClient],
  )

  const dismiss = useCallback(
    async (id: string) => {
      await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    [queryClient],
  )

  return createElement(
    NotificationsContext.Provider,
    { value: { notifications: visible, unreadCount, isLoading, markAsRead, dismiss } },
    children,
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      markAsRead: async () => {},
      dismiss: async () => {},
    }
  }
  return ctx
}
