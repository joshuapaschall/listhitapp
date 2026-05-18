"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import { ALLOWED_MMS_EXTENSIONS, MAX_MMS_SIZE, uploadMediaFile } from "@/utils/uploadMedia"
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

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const next = [...mediaUrls]
    for (const file of Array.from(files)) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`
      if (!ALLOWED_MMS_EXTENSIONS.includes(ext as any)) {
        toast.error(`Unsupported file type: ${file.name}`)
        continue
      }
      if (file.size > MAX_MMS_SIZE) {
        toast.error(`${file.name} exceeds 1MB limit`)
        continue
      }
      try {
        const url = await uploadMediaFile(file, "outgoing")
        next.push(url)
      } catch {
        toast.error(`Failed uploading ${file.name}`)
      }
    }
    onChange(next)
    setUploading(false)
  }

  return <div className="space-y-3">
    <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/30">Drop images here or click to browse</button>
    <input ref={inputRef} type="file" multiple accept={ALLOWED_MMS_EXTENSIONS.join(",")} className="hidden" onChange={(e) => onFiles(e.target.files)} />
    {mediaUrls.length > 0 && <div className="flex flex-wrap gap-2">{mediaUrls.map((url) => <div key={url} className="relative"><img src={url} className="h-20 w-20 rounded-md object-cover" /><Button size="icon" variant="destructive" className="absolute -right-2 -top-2 h-6 w-6" onClick={() => onChange(mediaUrls.filter((u) => u !== url))}><X className="h-3 w-3" /></Button></div>)}</div>}
    {mediaUrls.length > 0 && <Input maxLength={40} value={subject ?? ""} onChange={(e) => onSubjectChange(e.target.value ? e.target.value : null)} placeholder="Optional MMS subject" />}
    {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
  </div>
}
