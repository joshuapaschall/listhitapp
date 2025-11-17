"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import Image from "next/image"
import { ALLOWED_MMS_EXTENSIONS, MAX_MMS_SIZE } from "@/utils/uploadMedia"
import { resizeImage } from "@/utils/image"

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddFiles: (files: File[]) => void
}

export default function UploadModal({ open, onOpenChange, onAddFiles }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (incoming: File[]) => {
    const processed: File[] = []
    for (const f of incoming) {
      const resized = await resizeImage(f, MAX_MMS_SIZE)
      processed.push(resized)
    }
    setFiles((prev) => [...prev, ...processed])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const items = Array.from(e.dataTransfer.files)
    handleFiles(items)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const items = e.target.files ? Array.from(e.target.files) : []
    handleFiles(items)
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const add = () => {
    if (files.length) onAddFiles(files)
    setFiles([])
    onOpenChange(false)
  }

  const close = () => {
    setFiles([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>
        <div
          className="flex flex-col items-center justify-center p-4 border border-dashed rounded-md text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p>Drag & drop files here or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_MMS_EXTENSIONS.join(",")}
            className="hidden"
            onChange={handleChange}
          />
        </div>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, idx) => {
              const lower = file.name.toLowerCase()
              const isImg = /(jpg|jpeg|png|gif|bmp|webp)$/.test(lower)
              const isAudio = /(m4a|mp3|wav|ogg|oga|opus|amr|webm|3gp)$/.test(lower)
              const url = URL.createObjectURL(file)
              return (
                <div key={idx} className="relative inline-block">
                  {isImg ? (
                    <Image
                      src={url}
                      alt="preview"
                      width={128}
                      height={128}
                      className="max-h-32 rounded-md"
                    />
                  ) : isAudio ? (
                    <audio controls className="max-h-32">
                      <source src={url} type="audio/mpeg" />
                      Your browser doesn’t support audio.
                    </audio>
                  ) : (
                    <span className="block text-xs">{file.name}</span>
                  )}
                  <X
                    className="h-4 w-4 absolute -right-2 -top-2 bg-white dark:bg-gray-800 rounded-full cursor-pointer"
                    onClick={() => removeFile(idx)}
                  />
                </div>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={add} disabled={files.length === 0}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
