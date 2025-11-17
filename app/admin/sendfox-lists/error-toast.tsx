"use client"

import { useEffect } from "react"
import { toast } from "@/components/ui/use-toast"

interface ErrorToastProps {
  message?: string | null
}

export default function ErrorToast({ message }: ErrorToastProps) {
  useEffect(() => {
    if (message) {
      toast({
        variant: "destructive",
        title: "Failed to load SendFox lists",
        description: message,
      })
    }
  }, [message])

  return null
}
