"use client"

import React, { useState, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, UploadCloud, ImageIcon, Music2, Film } from "lucide-react"
import Image from "next/image"
import { MAX_MMS_SIZE } from "@/utils/uploadMedia"
import { resizeImage } from "@/utils/image"

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddFiles: (files: File[]) => void
  uploadType: "photo" | "video" | null
}

interface PreviewItem {
  file: File
  url: string
}

const PHOTO_AUDIO_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".m4a",
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".opus",
  ".amr",
  ".webm",
  ".weba",
]

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".3gp"]

const formatSize = (bytes: number) => `${Math.round(bytes / 1024)} KB`

export default function UploadModal({
  open,
  onOpenChange,
  onAddFiles,
  uploadType,
}: UploadModalProps) {
  const [previews, setPreviews] = useState<PreviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allowedExtensions = useMemo(() => {
    if (uploadType === "video") return VIDEO_EXTENSIONS
    return PHOTO_AUDIO_EXTENSIONS
  }, [uploadType])

  const acceptValue = useMemo(() => {
    if (uploadType === "video") return "video/mp4,video/webm,video/3gpp"
    return "image/jpeg,image/png,image/gif,image/webp,audio/*"
  }, [uploadType])

  const titleCopy = uploadType === "video" ? "Add video" : "Add photo or audio"

  const descriptionCopy =
    uploadType === "video"
      ? "MMS supports short MP4, WebM, or 3GP clips under 1MB. Bigger clips will be shared as download links."
      : "MMS supports photos (JPG, PNG, GIF, WEBP) and quick audio notes (MP3, OGG, WEBM, AMR) under 1MB. Larger files should be trimmed before sending."

  const reset = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url))
    setPreviews([])
    setError(null)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const handleFiles = async (incoming: File[]) => {
    if (!incoming.length) return

    const accepted: PreviewItem[] = []
    const rejected: string[] = []
    const oversize: string[] = []

    for (const f of incoming) {
      const lower = f.name.toLowerCase()
      const dot = lower.lastIndexOf(".")
      const ext = dot >= 0 ? lower.slice(dot) : ""

      if (!allowedExtensions.includes(ext)) {
        rejected.push(`${f.name} (unsupported type)`)
        continue
      }

      if (f.size > MAX_MMS_SIZE && !f.type.startsWith("image/")) {
        oversize.push(f.name)
      }

      const resized = await resizeImage(f, MAX_MMS_SIZE)
      accepted.push({
        file: resized,
        url: URL.createObjectURL(resized),
      })
    }

    setPreviews((prev) => [...prev, ...accepted])

    const messages: string[] = []

    if (rejected.length) {
      messages.push(
        `Skipped ${rejected.length} file${rejected.length > 1 ? "s" : ""}: ${rejected.join(
          ", ",
        )}. Only supported media under 1MB are allowed.`,
      )
    }

    if (oversize.length) {
      messages.push(
        `${oversize.length} file${oversize.length > 1 ? "s" : ""} over 1MB will send as download link${
          oversize.length > 1 ? "s" : ""
        } instead of MMS.`,
      )
    }

    setError(messages.length ? messages.join(" ") : null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    void handleFiles(files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    void handleFiles(files)
  }

  const removePreview = (idx: number) => {
    setPreviews((prev) => {
      const next = [...prev]
      const [removed] = next.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.url)
      return next
    })
  }

  const add = () => {
    if (!previews.length) return
    onAddFiles(previews.map((p) => p.file))
    close()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titleCopy}</DialogTitle>
          <DialogDescription>{descriptionCopy}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/50 bg-muted/40 px-6 py-8 text-center shadow-sm transition hover:border-primary/70 hover:bg-primary/5"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "copy"
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Drop files here{" "}
              <span className="text-muted-foreground">or click to browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {uploadType === "video"
                ? "MP4, WebM, or 3GP clips · under 1MB each"
                : "JPG, PNG, GIF, WEBP, and common audio · under 1MB each"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={acceptValue}
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {error}
            </div>
          )}

          {previews.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {previews.length} file{previews.length > 1 ? "s" : ""} ready to send
                </span>
                <button
                  type="button"
                  className="underline"
                  onClick={reset}
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                {previews.map((item, idx) => {
                  const file = item.file
                  const lower = file.name.toLowerCase()
                  const isImg = /(jpg|jpeg|png|gif|bmp|webp)$/.test(lower)
                  const isVideo =
                    /(mp4|webm|3gp)$/.test(lower) || file.type.startsWith("video/")
                  const isAudio =
                    /(m4a|mp3|wav|ogg|oga|opus|amr|webm|weba)$/.test(lower) ||
                    file.type.startsWith("audio/")

                  return (
                    <div
                      key={idx}
                      className="relative flex flex-col rounded-lg border bg-background p-2 text-xs shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => removePreview(idx)}
                        className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-[10px] shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="mb-1 flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-muted">
                        {isImg ? (
                          <Image
                            src={item.url}
                            alt={file.name}
                            width={160}
                            height={160}
                            className="h-full w-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Film className="mb-1 h-5 w-5" />
                            <span className="text-[10px]">Video</span>
                          </div>
                        ) : isAudio ? (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Music2 className="mb-1 h-5 w-5" />
                            <span className="text-[10px]">Audio</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <ImageIcon className="mb-1 h-5 w-5" />
                            <span className="text-[10px]">File</span>
                          </div>
                        )}
                      </div>
                      <div className="truncate text-[11px] font-medium">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatSize(file.size)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={add} disabled={previews.length === 0}>
            Add to message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
