"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { supabase, type Message } from "@/lib/supabase"
import unlockAudio from "@/utils/unlock-audio"

export default function useRealtimeNotifications() {
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false)
  const unlockedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const audio = new Audio("/sounds/new-message.mp3")
    const cleanup = unlockAudio(audio, () => {
      unlockedRef.current = true
      setIsAudioUnlocked(true)
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {})
      }
    })

    const channel = supabase
      .channel("messages:new_inbound")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "direction=eq.inbound",
        },
        (payload) => {
          const msg = payload.new as Message
          if (unlockedRef.current) {
            audio.currentTime = 0
            audio.play().catch(() => {})
          } else if (Notification.permission === "granted") {
            new Notification("New Message", { body: msg.body ?? "" })
          } else if (Notification.permission === "denied") {
            toast.info("Enable browser notifications to receive alerts")
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      cleanup()
    }
  }, [])
}

