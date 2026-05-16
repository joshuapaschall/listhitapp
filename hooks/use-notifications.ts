"use client"

import { useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase, type Notification } from "@/lib/supabase"

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Failed to fetch notifications")
      return res.json() as Promise<Notification[]>
    },
    refetchInterval: 60_000,
  })

  useEffect(() => {
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
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const unreadCount = notifications.filter((n) => !n.read_at && !n.dismissed_at).length

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

  const visible = notifications.filter((n) => !n.dismissed_at)

  return { notifications: visible, unreadCount, isLoading, markAsRead, dismiss }
}
