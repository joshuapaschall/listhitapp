"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface VoiceRecorderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (file: File) => void
}

export default function VoiceRecorder({ open, onOpenChange, onSave }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    if (!open) {
      setRecording(false)
      setUrl(null)
      recorder.current = null
      chunks.current = []
    }
  }, [open])

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream)
    chunks.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" })
      setUrl(URL.createObjectURL(blob))
    }
    rec.start()
    recorder.current = rec
    setRecording(true)
  }

  const stop = () => {
    recorder.current?.stop()
    setRecording(false)
  }

  const save = async () => {
    if (!url) return
    const blob = await fetch(url).then((r) => r.blob())
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type })
    onSave(file)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>Record Audio</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 flex flex-col items-center">
          {url && <audio controls src={url} className="w-full" />}
          {!recording && (
            <Button variant="outline" className="w-full" onClick={start}>
              Start Recording
            </Button>
          )}
          {recording && (
            <Button variant="destructive" className="w-full" onClick={stop}>
              Stop Recording
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!url}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
