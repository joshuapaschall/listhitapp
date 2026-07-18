"use client"

import { useRef, useState } from "react"
import { Image as ImageIcon, X } from "lucide-react"
import { toast } from "sonner"
import { ALLOWED_MMS_EXTENSIONS, MAX_MMS_SIZE, uploadMediaFile } from "@/utils/uploadMedia"
import { resizeImageFile } from "@/lib/images/resize-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SmsMediaCardProps {
  mediaUrls: string[]
  onChange: (urls: string[]) => void
  subject: string | null
  onSubjectChange: (value: string | null) => void
}

export default function SmsMediaCard({ mediaUrls, onChange, subject, onSubjectChange }: SmsMediaCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const next = [...mediaUrls]
    for (const original of Array.from(files)) {
      const ext = `.${original.name.split(".").pop()?.toLowerCase() || ""}`
      if (!ALLOWED_MMS_EXTENSIONS.includes(ext as any)) {
        toast.error(`Unsupported file type: ${original.name}`)
        continue
      }
      // Auto-downscale/compress images so oversized photos upload instead of
      // hard-failing. Non-images pass through untouched.
      let file = original
      try {
        file = await resizeImageFile(original)
      } catch {
        file = original // best-effort — fall back to the original on any failure
      }
      // Only reject if it's STILL over the MMS ceiling after resize (rare).
      if (file.size > MAX_MMS_SIZE) {
        toast.error(`${original.name} is too large to send as MMS, even after resizing.`)
        continue
      }
      try {
        const url = await uploadMediaFile(file, "outgoing")
        next.push(url)
      } catch {
        toast.error(`Failed uploading ${original.name}`)
      }
    }
    onChange(next)
    setUploading(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    onFiles(e.dataTransfer.files)
  }

  return <div className="space-y-3" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click() }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-brand bg-brand/5" : "border-border hover:bg-muted/30"}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{dragOver ? "Drop to upload" : "Drag images here or click to browse"}</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP — images auto-resized to fit</p>
      </div>
    </div>
    <input ref={inputRef} type="file" multiple accept={ALLOWED_MMS_EXTENSIONS.join(",")} className="hidden" onChange={(e) => onFiles(e.target.files)} />
    {mediaUrls.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {mediaUrls.map((url) => (
          <div key={url} className="relative">
            <img src={url} alt="MMS attachment" className="h-20 w-20 rounded-md border object-cover" />
            <Button size="icon" variant="destructive" className="absolute -right-2 -top-2 h-6 w-6" onClick={() => onChange(mediaUrls.filter((u) => u !== url))}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    )}
    {mediaUrls.length > 0 && (
      <Input maxLength={40} value={subject ?? ""} onChange={(e) => onSubjectChange(e.target.value ? e.target.value : null)} placeholder="Optional MMS subject" />
    )}
    {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
  </div>
}
