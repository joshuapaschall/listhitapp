"use client"

import { useEffect, useMemo, useState } from "react"
import DOMPurify from "dompurify"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export type EmailBlockType = "heading" | "text" | "button" | "divider"

export interface EmailBlock {
  id: string
  type: EmailBlockType
  content: string
  href?: string
}

export interface EmailBuilderValue {
  subject: string
  html: string
  blocks: EmailBlock[]
  markdown: string
  previewText?: string
  format: "blocks" | "markdown"
}

interface EmailBuilderProps {
  value?: EmailBuilderValue
  onChange?: (value: EmailBuilderValue) => void
}

function basicMarkdownToHtml(md: string) {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  const withStrong = escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
  return withStrong
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("\n")
}

function renderBlocks(blocks: EmailBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "divider") return `<hr style="border:1px solid #e5e7eb" />`
      if (block.type === "heading")
        return `<h2 style="margin:16px 0;font-size:24px;font-weight:700">${block.content}</h2>`
      if (block.type === "button") {
        const href = block.href || "#"
        return `<a href="${href}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;margin:12px 0;">${block.content}</a>`
      }
      return `<p style="margin:12px 0;line-height:1.6">${block.content.replace(/\n/g, "<br />")}</p>`
    })
    .join("\n")
}

export default function EmailBuilder({ value, onChange }: EmailBuilderProps) {
  const [subject, setSubject] = useState(value?.subject || "")
  const [previewText, setPreviewText] = useState(value?.previewText || "")
  const [blocks, setBlocks] = useState<EmailBlock[]>(value?.blocks || [])
  const [markdown, setMarkdown] = useState(value?.markdown || "")
  const [mode, setMode] = useState<"blocks" | "markdown">(value?.format || "blocks")
  const [dragging, setDragging] = useState<string | null>(null)

  const sanitizedHtml = useMemo(() => {
    const html = mode === "blocks" ? renderBlocks(blocks) : basicMarkdownToHtml(markdown)
    return DOMPurify.sanitize(html)
  }, [blocks, markdown, mode])

  useEffect(() => {
    if (!onChange) return
    onChange({
      subject,
      html: sanitizedHtml,
      blocks,
      markdown,
      previewText,
      format: mode,
    })
  }, [subject, sanitizedHtml, blocks, markdown, previewText, mode, onChange])

  const addBlock = (type: EmailBlockType) => {
    const defaults: Record<EmailBlockType, Partial<EmailBlock>> = {
      heading: { content: "New headline" },
      text: { content: "Paragraph text" },
      button: { content: "Call to Action", href: "https://" },
      divider: { content: "" },
    }
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    setBlocks((prev) => [...prev, { id, type, content: "", ...defaults[type] }])
  }

  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const current = [...blocks]
    const from = current.findIndex((b) => b.id === dragging)
    const to = current.findIndex((b) => b.id === targetId)
    if (from === -1 || to === -1) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    setBlocks(current)
    setDragging(null)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Email Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Campaign subject" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Preview Text</label>
            <Input
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Shown in inbox previews"
            />
          </div>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "blocks" | "markdown")}> 
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>
          <TabsContent value="blocks" className="grid gap-4 md:grid-cols-[320px_1fr]">
            <div className="space-y-3 rounded-lg border p-3 bg-muted/40">
              <h3 className="text-sm font-semibold">Drag & Drop blocks</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addBlock("heading")}>Heading</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("text")}>Text</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("button")}>Button</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("divider")}>Divider</Button>
              </div>
              <ScrollArea className="h-[360px] rounded-md border bg-background">
                <div className="p-3 space-y-3">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={() => setDragging(block.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(block.id)}
                      className="rounded-md border bg-card p-3 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{block.type}</span>
                        <Badge variant="outline">drag</Badge>
                      </div>
                      {block.type === "heading" && (
                        <Input
                          value={block.content}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b) => (b.id === block.id ? { ...b, content: e.target.value } : b)),
                            )
                          }
                          placeholder="Headline text"
                        />
                      )}
                      {block.type === "text" && (
                        <Textarea
                          value={block.content}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b) => (b.id === block.id ? { ...b, content: e.target.value } : b)),
                            )
                          }
                          className="min-h-[120px]"
                        />
                      )}
                      {block.type === "button" && (
                        <div className="space-y-2">
                          <Input
                            value={block.content}
                            onChange={(e) =>
                              setBlocks((prev) =>
                                prev.map((b) => (b.id === block.id ? { ...b, content: e.target.value } : b)),
                              )
                            }
                            placeholder="Button label"
                          />
                          <Input
                            value={block.href || ""}
                            onChange={(e) =>
                              setBlocks((prev) =>
                                prev.map((b) => (b.id === block.id ? { ...b, href: e.target.value } : b)),
                              )
                            }
                            placeholder="https://link"
                          />
                        </div>
                      )}
                      {block.type === "divider" && (
                        <div className="text-xs text-muted-foreground">Horizontal rule</div>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                        >
                          Remove
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, content: "" } : b)))}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!blocks.length && (
                    <div className="text-sm text-muted-foreground">Add blocks to start composing.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Live preview</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="prose max-w-none text-sm leading-6" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </Card>
          </TabsContent>
          <TabsContent value="markdown" className="grid gap-4 md:grid-cols-2">
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="min-h-[420px]"
              placeholder="Write markdown or HTML..."
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
