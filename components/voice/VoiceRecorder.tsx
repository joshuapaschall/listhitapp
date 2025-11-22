"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { uploadMediaFileWithMeta } from "@/utils/uploadMedia"

interface VoiceRecorderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (file: File) => void
}

export default function VoiceRecorder({ open, onOpenChange, onSave }: VoiceRecorderProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "preview">("idle")
  const [url, setUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<NodeJS.Timeout | null>(null)
  const startTime = useRef<number | null>(null)

  const reset = () => {
    setStatus("idle")
    setUrl(null)
    setElapsed(0)
    setIsSaving(false)
    recorder.current = null
    chunks.current = []
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
    startTime.current = null
  }

  useEffect(() => {
    if (!open) {
      if (recorder.current?.state === "recording") {
        recorder.current.stop()
      }
      reset()
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [open])

  const startTimer = () => {
    if (timer.current) clearInterval(timer.current)
    startTime.current = Date.now()
    setElapsed(0)
    timer.current = setInterval(() => {
      if (startTime.current) {
        const seconds = Math.floor((Date.now() - startTime.current) / 1000)
        setElapsed(seconds)
      }
    }, 500)
  }

  const formatTime = useMemo(
    () => (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    },
    [],
  )

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunks.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" })
        setUrl(URL.createObjectURL(blob))
        setStatus("preview")
        if (timer.current) clearInterval(timer.current)
      }
      rec.start()
      recorder.current = rec
      setStatus("recording")
      startTimer()
    } catch (err) {
      console.error("Failed to start recorder", err)
      toast.error("Microphone access is required to record audio")
    }
  }

  const stop = () => {
    if (recorder.current?.state === "recording") {
      recorder.current.stop()
      recorder.current.stream.getTracks().forEach((track) => track.stop())
    }
  }

  const save = async () => {
    if (!url || isSaving) return
    setIsSaving(true)
    try {
      const blob = await fetch(url).then((r) => r.blob())
      const webmFile = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || "audio/webm",
      })

      const upload = await uploadMediaFileWithMeta(webmFile, "outgoing")
      const res = await fetch("/api/media/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: upload.url, direction: "outgoing" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        throw new Error(
          data.error || "Failed to process recording. Please try again.",
        )
      }

      const mp3Response = await fetch(data.url)
      if (!mp3Response.ok) {
        throw new Error("Unable to load converted audio. Please retry.")
      }
      const mp3Blob = await mp3Response.blob()
      const mp3File = new File([mp3Blob], `recording-${Date.now()}.mp3`, {
        type: "audio/mpeg",
      })

      onSave(mp3File)
      toast.success("Recording converted to MP3")
      onOpenChange(false)
      reset()
    } catch (err) {
      console.error("Recording conversion failed", err)
      toast.error((err as Error).message || "Failed to process recording")
    } finally {
      setIsSaving(false)
    }
  }

  const reRecord = async () => {
    reset()
    await start()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px]">
        <DialogHeader>
          <DialogTitle>Record Audio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {status === "recording" && (
            <div className="flex items-center justify-between rounded-lg border bg-muted px-3 py-2">
              <div className="flex items-center gap-2 text-destructive">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                <span className="text-sm font-medium">Recording…</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatTime(elapsed)}</span>
            </div>
          )}

          {status === "preview" && url && (
            <div className="space-y-2">
              <audio controls src={url} className="w-full" />
              <div className="flex items-center justify-between rounded-lg border bg-muted px-3 py-2">
                <span className="text-sm text-muted-foreground">Recorded clip</span>
                <span className="text-sm font-semibold tabular-nums">{formatTime(elapsed)}</span>
              </div>
            </div>
          )}

          {status === "idle" && (
            <Button variant="destructive" className="w-full h-12 text-base" onClick={start}>
              Start recording
            </Button>
          )}

          {status === "recording" && (
            <Button variant="secondary" className="w-full h-12 text-base" onClick={stop}>
              Stop
            </Button>
          )}

          {status === "preview" && (
            <div className="flex gap-2">
              <Button variant="outline" className="w-full" onClick={reRecord} disabled={isSaving}>
                Re-record
              </Button>
              <Button className="w-full" onClick={save} disabled={!url || isSaving}>
                {isSaving ? "Processing…" : "Use this recording"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          {status === "preview" && (
            <Button onClick={save} disabled={!url || isSaving}>
              {isSaving ? "Processing…" : "Use this recording"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
