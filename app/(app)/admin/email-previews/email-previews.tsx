"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { SampleEmail } from "@/lib/email/samples"

const AUDIENCE: Record<SampleEmail["audience"], string> = {
  customer: "Customer",
  admin: "Admin",
  buyer: "Buyer (tenant brand)",
  auth: "Supabase Auth",
}

export function EmailPreviews({ emails }: { emails: SampleEmail[] }) {
  const [selected, setSelected] = useState(emails[0]?.key)
  const [mode, setMode] = useState<"html" | "text">("html")
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop")
  const email = emails.find((e) => e.key === selected) ?? emails[0]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Email previews</h1>
        <p className="text-sm text-muted-foreground">Every transactional email, rendered with sample data exactly as it sends.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="h-fit p-2">
          {emails.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setSelected(e.key)}
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm", e.key === email?.key ? "bg-brand/10 font-semibold text-brand" : "hover:bg-muted")}
            >
              {e.name}
              <span className="block text-[11px] font-normal text-muted-foreground">{AUDIENCE[e.audience]}</span>
            </button>
          ))}
        </Card>
        {email ? (
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-sm">
                <span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{email.subject}</span>
              </div>
              <div className="flex gap-1 text-xs">
                {(["html", "text"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md border px-2.5 py-1", mode === m ? "border-brand bg-brand text-brand-fg" : "hover:bg-muted")}>
                    {m === "html" ? "HTML" : "Plain text"}
                  </button>
                ))}
                {mode === "html"
                  ? (["desktop", "mobile"] as const).map((w) => (
                      <button key={w} type="button" onClick={() => setWidth(w)} className={cn("rounded-md border px-2.5 py-1", width === w ? "border-foreground" : "hover:bg-muted")}>
                        {w === "desktop" ? "Desktop" : "375px"}
                      </button>
                    ))
                  : null}
              </div>
            </div>
            {mode === "html" ? (
              <div className="flex justify-center rounded-lg bg-muted/50 p-2">
                <iframe
                  title={email.name}
                  srcDoc={email.html}
                  sandbox=""
                  className="h-[720px] rounded-md border bg-white"
                  style={{ width: width === "mobile" ? 375 : "100%" }}
                />
              </div>
            ) : (
              <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-xs">{email.text}</pre>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  )
}
