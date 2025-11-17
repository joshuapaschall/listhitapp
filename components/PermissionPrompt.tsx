"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import unlockAudio from "@/utils/unlock-audio"

export default function PermissionPrompt() {
  const [open, setOpen] = useState(false)

  const checkPermissions = async () => {
    if (typeof window === "undefined") return
    const audioUnlocked = localStorage.getItem("audioUnlocked") === "true"
    const notifGranted = Notification.permission === "granted"
    let micGranted = false
    try {
      const status = await navigator.permissions?.query({
        // safari's typings don't include "microphone" so cast
        name: "microphone" as PermissionName,
      })
      micGranted = status?.state === "granted"
    } catch {
      micGranted = localStorage.getItem("microphoneGranted") === "true"
    }

    if (micGranted && notifGranted && audioUnlocked) {
      setOpen(false)
    } else {
      setOpen(true)
    }
  }

  useEffect(() => {
    checkPermissions()
  }, [])

  const enable = async () => {
    const audio = new Audio("/sounds/incoming-call.mp3")
    const cleanup = unlockAudio(audio)

    const micPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        localStorage.setItem("microphoneGranted", "true")
        return true
      })
      .catch(() => false)

    const notifPromise = Notification.requestPermission()
      .then((p) => p === "granted")
      .catch(() => false)

    const soundPromise = audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        localStorage.setItem("audioUnlocked", "true")
        return true
      })
      .catch(() => false)

    const [micGranted, notifGranted, soundGranted] = await Promise.all([
      micPromise,
      notifPromise,
      soundPromise,
    ])
    cleanup()

    if (micGranted && notifGranted && soundGranted) {
      localStorage.setItem("permissionsGranted", "true")
      window.dispatchEvent(new Event("permissionsgranted"))
      setOpen(false)
    } else {
      await checkPermissions()
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permissions Required</DialogTitle>
          <DialogDescription>
            To use DispoTool, please allow microphone, notifications and sound access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={enable}>Enable Permissions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
