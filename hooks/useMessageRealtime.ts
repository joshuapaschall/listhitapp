"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { supabase, type Message } from "@/lib/supabase"

interface Options {
  enableSound?: boolean
}

export default function useMessageRealtime(opts?: Options) {
  useEffect(() => {
    if (typeof window === "undefined") return

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }

    const channel = supabase
      .channel("messages-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message
          toast.info(`New message from ${msg.from_number}`, {
            description: msg.body ?? "",
          })
          if (opts?.enableSound) {
            const audio = new Audio("/sounds/new-message.mp3")
            audio.play().catch(() => {})
          }
          if (Notification.permission === "granted") {
            navigator.serviceWorker.getRegistration()?.then((reg) => {
              reg?.showNotification("New Message", {
                body: msg.body ?? "",
                tag: msg.id,
              })
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [opts?.enableSound])
}
