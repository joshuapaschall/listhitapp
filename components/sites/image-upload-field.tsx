"use client"
import { useRef, useState } from "react"
import { Upload, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useSiteForm } from "@/lib/site-builder/site-context"
import { ASSET_ACCEPT, downscaleImage, uploadSiteAsset } from "@/lib/site-builder/upload-asset"

export function ImageUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { siteId } = useSiteForm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!siteId) { setError("Save your site first, then upload."); return }
    setError(""); setUploading(true)
    try {
      const optimized = await downscaleImage(file, 1600)
      const url = await uploadSiteAsset(optimized, siteId)
      onChange(url)
    } catch (e: any) {
      setError(e?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ASSET_ACCEPT}
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.currentTarget.value = "" }}
      />
      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-20 w-full rounded-md border border-border object-cover" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={uploading}>
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex w-full items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 p-3 text-left transition-colors hover:border-brand hover:bg-brand/5",
            uploading && "opacity-60",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{uploading ? "Uploading…" : "Upload image"}</span>
            <span className="block text-xs text-muted-foreground">JPG, PNG, WEBP or SVG. Wide landscape works best.</span>
          </span>
        </button>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <details className="group">
        <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground">or paste an image URL</summary>
        <Input className="mt-2" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </details>
    </div>
  )
}
