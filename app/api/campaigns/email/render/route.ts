import { NextRequest, NextResponse } from "next/server"
import { renderToMjml } from "@templatical/renderer"
import mjml2html from "mjml"
import type { TemplateContent } from "@templatical/types"
import { requireOrgContext } from "@/lib/auth/org-context"
import { EMAIL_CUSTOM_FONTS, EMAIL_DEFAULT_FALLBACK } from "@/lib/email-templates/email-fonts"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { user, orgId } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    let body: { design?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const design = body.design as TemplateContent | undefined
    if (!design || typeof design !== "object" || !Array.isArray((design as TemplateContent).blocks)) {
      return NextResponse.json({ error: "design is required" }, { status: 400 })
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/+$/, "")
    const socialIconsBaseUrl = origin ? `${origin}/email-assets/social` : undefined

    const mjml = await renderToMjml(design, {
      customFonts: EMAIL_CUSTOM_FONTS,
      defaultFallbackFont: EMAIL_DEFAULT_FALLBACK,
      ...(socialIconsBaseUrl ? { socialIconsBaseUrl } : {}),
    })
    const result = await mjml2html(mjml, { validationLevel: "soft" })

    if (result.errors.length > 0) {
      console.error("[email-render] mjml errors", result.errors)
      return NextResponse.json(
        {
          error: "Email failed to render cleanly",
          errors: result.errors.map((e) => e.formattedMessage),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ html: result.html, mjml })
  } catch (err) {
    const message = err instanceof Error ? err.message : "MJML compile failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
