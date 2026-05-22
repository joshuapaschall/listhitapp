"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Code2, Plus, X } from "lucide-react"
import { BASIC_TEMPLATES, FULLY_DESIGNED_TEMPLATES, type EmailTemplateDef } from "@/lib/email-templates"
import WireframePreview, { type WireframeVariant } from "./wireframe-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export type EmailPickResult =
  | { kind: "template"; def: EmailTemplateDef }
  | { kind: "scratch" }
  | { kind: "html" }

interface Props {
  onPick: (result: EmailPickResult) => void
  onClose: () => void
  initialBucket?: "basic" | "fully-designed"
}

export default function EmailTemplatePicker({ onPick, onClose, initialBucket }: Props) {
  const [view, setView] = useState<"chooser" | "gallery">(initialBucket ? "gallery" : "chooser")
  const [bucket, setBucket] = useState<"basic" | "fully-designed">(initialBucket ?? "basic")

  useEffect(() => {
    if (initialBucket) {
      setBucket(initialBucket)
      setView("gallery")
    }
  }, [initialBucket])

  return view === "chooser" ? (
    <div className="relative mx-auto max-w-6xl py-2">
      <Button variant="ghost" size="icon" className="absolute right-0 top-0" onClick={onClose} aria-label="Close picker">
        <X className="h-4 w-4" />
      </Button>
      <h2 className="mb-8 mt-8 text-center text-3xl font-bold">How do you want to design your email?</h2>

      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onPick({ kind: "scratch" })}
          className="cursor-pointer rounded-xl border p-4 text-left transition hover:border-brand hover:shadow-md"
        >
          <Card className="border-0 p-0 shadow-none">
            <div className="mb-4 grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-brand/40 bg-brand/5">
              <Plus className="h-10 w-10 text-brand" />
            </div>
            <p className="mb-2 text-lg font-semibold text-brand">From scratch</p>
            <p className="text-sm text-muted-foreground">Begin with a blank canvas to fully customize your email&apos;s design and content.</p>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setBucket("basic")
            setView("gallery")
          }}
          className="cursor-pointer rounded-xl border p-4 text-left transition hover:border-brand hover:shadow-md"
        >
          <Card className="border-0 p-0 shadow-none">
            <div className="pointer-events-none mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-2">
              {(["single", "image-text", "two-thirds-left", "cta"] as WireframeVariant[]).map((variant) => (
                <div key={variant} className="scale-[0.96]">
                  <WireframePreview variant={variant} />
                </div>
              ))}
            </div>
            <p className="mb-2 text-lg font-semibold">Basic layout</p>
            <p className="text-sm text-muted-foreground">Start with basic elements to easily manipulate content and quickly shape your message.</p>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => {
            setBucket("fully-designed")
            setView("gallery")
          }}
          className="cursor-pointer rounded-xl border p-4 text-left transition hover:border-brand hover:shadow-md"
        >
          <Card className="border-0 p-0 shadow-none">
            <div className="pointer-events-none mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-2">
              {FULLY_DESIGNED_TEMPLATES.slice(0, 4).map((def) => (
                <img
                  key={def.id}
                  src={def.previewImage}
                  alt={def.name}
                  className="aspect-[3/4] w-full rounded object-cover"
                  loading="lazy"
                />
              ))}
            </div>
            <p className="mb-2 text-lg font-semibold">Fully designed template</p>
            <p className="text-sm text-muted-foreground">Choose a professionally designed template and adjust it to your needs with ease.</p>
          </Card>
        </button>
      </div>

      <div className="mt-6 text-center">
        <Button variant="secondary" size="sm" onClick={() => onPick({ kind: "html" })}>
          <Code2 className="mr-2 h-4 w-4" />
          Use HTML to code my own
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b bg-background pb-3">
        <Button variant="ghost" size="icon" onClick={() => setView("chooser")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">Select a template</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as "basic" | "fully-designed")}>
        <TabsList>
          <TabsTrigger value="basic">Basic layouts</TabsTrigger>
          <TabsTrigger value="fully-designed">Fully designed</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="grid grid-cols-2 gap-5 pb-4 md:grid-cols-3 lg:grid-cols-4">
              {BASIC_TEMPLATES.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => onPick({ kind: "template", def })}
                  className="cursor-pointer rounded-xl border p-3 text-left transition hover:border-brand hover:shadow-md hover:ring-1 hover:ring-brand/40"
                >
                  <Card className="border-0 p-0 shadow-none">
                    <div className="rounded-md border bg-muted p-2">
                      <WireframePreview variant={def.wireframeVariant as WireframeVariant} />
                    </div>
                    <p className="mt-3 font-medium">{def.name}</p>
                    <p className="text-sm text-muted-foreground">{def.description}</p>
                  </Card>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="fully-designed" className="mt-4">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="grid grid-cols-2 gap-5 pb-4 md:grid-cols-3 lg:grid-cols-4">
              {FULLY_DESIGNED_TEMPLATES.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => onPick({ kind: "template", def })}
                  className="relative cursor-pointer rounded-xl border p-3 text-left transition hover:border-brand hover:shadow-md hover:ring-1 hover:ring-brand/40"
                >
                  <Card className="border-0 p-0 shadow-none">
                    <Badge className="absolute right-5 top-5" variant="secondary">{def.category}</Badge>
                    <img src={def.previewImage} alt={def.name} className="aspect-[3/4] w-full rounded-md border object-cover" loading="lazy" />
                    <p className="mt-3 font-medium">{def.name}</p>
                    <p className="text-sm text-muted-foreground">{def.description}</p>
                  </Card>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="pt-3">
        <Button variant="ghost" onClick={() => onPick({ kind: "scratch" })}>Start from scratch</Button>
      </div>
    </div>
  )
}
