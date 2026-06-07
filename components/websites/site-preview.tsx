"use client"

import { useMemo, useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SiteRenderer } from "@/components/sites/site-renderer"
import { composePreview, type WizardContent } from "@/lib/site-builder/compose"
import { googleFontsHref } from "@/lib/site-builder/typography"
import type { SitePersona, SiteTemplateId, SiteTheme } from "@/lib/site-builder/types"

interface SitePreviewProps {
  templateId: SiteTemplateId
  persona: SitePersona
  theme: SiteTheme
  content: Partial<WizardContent>
}

export function SitePreview({ templateId, persona, theme, content }: SitePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")

  const data = useMemo(
    () => composePreview(templateId, persona, theme, content),
    [templateId, persona, theme, content],
  )

  return (
    <div className="flex h-full flex-col">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(theme.typeStyleId)} />
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">Live preview</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === "mobile" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted p-4">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border border-border bg-background shadow-sm",
            device === "mobile" ? "w-[390px] max-w-full" : "w-full",
          )}
        >
          <SiteRenderer data={data} theme={theme} />
        </div>
      </div>
    </div>
  )
}
