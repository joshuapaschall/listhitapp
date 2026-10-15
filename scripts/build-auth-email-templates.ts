// Writes supabase/email-templates/*.html from lib/email/auth-templates.ts so the
// Supabase Auth emails use the exact ListHit email design.
//
//   pnpm dlx tsx scripts/build-auth-email-templates.ts
//
// Then paste each file into Supabase → Authentication → Emails (see
// docs/setup/supabase-auth-email.md).

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { buildAuthTemplates } from "@/lib/email/auth-templates"

const outDir = join(process.cwd(), "supabase", "email-templates")
mkdirSync(outDir, { recursive: true })
for (const t of buildAuthTemplates()) {
  writeFileSync(join(outDir, t.file), t.html)
  console.log(`wrote ${t.file}  (subject: ${t.subject})`)
}
