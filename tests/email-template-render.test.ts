import { renderToMjml } from "@templatical/renderer"
import mjml2html from "mjml"
import type { CustomFont } from "@templatical/types"

// The template modules read NEXT_PUBLIC_SITE_URL at import time to build absolute
// asset URLs, so the env must be set before they are (dynamically) imported.
const ORIGIN = "https://mail.test.example"

type TemplateDef = { id: string; build: () => any }

let ALL_EMAIL_TEMPLATES: TemplateDef[]
let EMAIL_CUSTOM_FONTS: CustomFont[]
let EMAIL_DEFAULT_FALLBACK: string

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN
  ;({ ALL_EMAIL_TEMPLATES } = (await import("@/lib/email-templates")) as any)
  ;({ EMAIL_CUSTOM_FONTS, EMAIL_DEFAULT_FALLBACK } = await import(
    "@/lib/email-templates/email-fonts"
  ))
})

describe("email templates render cleanly", () => {
  test("every template compiles with no MJML errors and clean output", async () => {
    expect(ALL_EMAIL_TEMPLATES.length).toBeGreaterThan(0)

    for (const template of ALL_EMAIL_TEMPLATES) {
      const mjml = await renderToMjml(template.build(), {
        customFonts: EMAIL_CUSTOM_FONTS,
        defaultFallbackFont: EMAIL_DEFAULT_FALLBACK,
      })
      const result = await mjml2html(mjml, { validationLevel: "soft" })
      const label = `[${template.id}]`

      // 1. No MJML errors.
      expect(result.errors, `${label} mjml errors: ${JSON.stringify(result.errors)}`).toHaveLength(0)

      const html = result.html

      // 2. No nested headings.
      expect(html, `${label} nested heading`).not.toMatch(/<h([1-6])[^>]*>\s*<h[1-6]/)

      // 3. Fonts + real preheader are emitted.
      expect(mjml, `${label} missing <mj-font>`).toContain("<mj-font")
      expect(mjml, `${label} missing <mj-preview>`).toContain("<mj-preview>")

      // 4. Fake preheader is gone.
      expect(html, `${label} fake preheader present`).not.toContain(
        "View this email in your browser",
      )

      // 5. No dead links and no relative asset paths.
      const attrs = html.match(/(?:href|src)="([^"]*)"/g) ?? []
      for (const attr of attrs) {
        const value = attr.replace(/^(?:href|src)="/, "").replace(/"$/, "")
        expect(value, `${label} bare https:// in ${attr}`).not.toBe("https://")
      }
      const srcs = html.match(/src="([^"]*)"/g) ?? []
      for (const src of srcs) {
        const value = src.replace(/^src="/, "").replace(/"$/, "")
        expect(value.startsWith("/"), `${label} relative src ${src}`).toBe(false)
      }

      // 6. No unpkg hotlinks.
      expect(html, `${label} unpkg hotlink`).not.toContain("unpkg.com")
    }
  })
})
