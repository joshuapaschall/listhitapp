// supabase/email-templates/*.html are generated from lib/email/auth-templates.ts
// (renderEmail, ListHit theme). If this fails, regenerate:
//   pnpm dlx tsx scripts/build-auth-email-templates.ts

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { buildAuthTemplates } from "@/lib/email/auth-templates"

describe("Supabase auth email templates", () => {
  test.each(buildAuthTemplates().map((t) => [t.file, t] as const))("%s matches the generator", (file, t) => {
    const onDisk = readFileSync(join(process.cwd(), "supabase", "email-templates", file), "utf8")
    expect(onDisk).toBe(t.html)
    expect(onDisk).toContain('href="{{ .ConfirmationURL }}"')
  })
})
