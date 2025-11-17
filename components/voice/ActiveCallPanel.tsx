"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useTelnyxDevice } from "./TelnyxDeviceProvider"

export default function ActiveCallPanel() {
  const { activeCall, disconnectCall } = useTelnyxDevice()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!activeCall) {
      setSeconds(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [activeCall])

  if (!activeCall) return null

  const number = activeCall.parameters?.To || activeCall.parameters?.From

  return (
    <div className="fixed bottom-4 right-4 bg-background p-4 rounded shadow flex items-center gap-2">
      <div className="mr-auto">On call with {number} ({seconds}s)</div>
      <Button size="sm" onClick={() => activeCall.toggleAudioMute()}>
        {activeCall.isAudioMuted ? "Unmute" : "Mute"}
      </Button>
      <Button size="sm" variant="destructive" onClick={disconnectCall}>
        Hang Up
      </Button>
    </div>
  )
}
