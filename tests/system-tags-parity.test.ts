// The system tag list exists in three places that must never drift:
//   - the ARRAY[...] literal in the tags-management migration
//   - SYSTEM_TAGS in lib/tags/system-tags.ts
//   - the hard-coded names in lib/buyer-taxonomy.ts
// If they diverge, a website signup can apply a tag the vocabulary is missing,
// or the migration can fail to protect a name the code depends on.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { SYSTEM_TAGS, isSystemTag } from "@/lib/tags/system-tags"
import { PERSONA_BASE_TAGS, BUYER_TYPE_MAP, PAYMENT_MAP } from "@/lib/buyer-taxonomy"

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20261005000002_tags_management.sql",
)

/** Pull the quoted names out of the first CROSS JOIN unnest(ARRAY[...]) block. */
function migrationSystemTags(): string[] {
  const sql = readFileSync(MIGRATION, "utf8")
  const match = sql.match(/CROSS JOIN unnest\(ARRAY\[([\s\S]*?)\]\)/)
  if (!match) throw new Error("Could not find the system tag ARRAY[...] in the migration")
  return Array.from(match[1].matchAll(/'((?:[^']|'')*)'/g)).map((m) => m[1].replace(/''/g, "'"))
}

describe("system tag parity", () => {
  test("the migration array matches SYSTEM_TAGS exactly", () => {
    const fromSql = migrationSystemTags()
    expect(fromSql).toHaveLength(SYSTEM_TAGS.length)
    expect(new Set(fromSql)).toEqual(new Set(SYSTEM_TAGS))
  })

  test("the protection-reset array matches too", () => {
    // The migration repeats the list in `name <> ALL (ARRAY[...])`. If only one
    // copy were updated, real system tags would be un-protected.
    const sql = readFileSync(MIGRATION, "utf8")
    const match = sql.match(/name <> ALL \(ARRAY\[([\s\S]*?)\]\)/)
    expect(match).toBeTruthy()
    const names = Array.from(match![1].matchAll(/'((?:[^']|'')*)'/g)).map((m) =>
      m[1].replace(/''/g, "'"),
    )
    expect(new Set(names)).toEqual(new Set(SYSTEM_TAGS))
  })

  test("every tag name the signup taxonomy can apply is a system tag", () => {
    const taxonomyNames = new Set<string>()
    for (const names of Object.values(PERSONA_BASE_TAGS)) {
      for (const name of names) taxonomyNames.add(name)
    }
    for (const derivation of Object.values(BUYER_TYPE_MAP)) {
      for (const name of derivation.tags) taxonomyNames.add(name)
    }
    for (const derivation of Object.values(PAYMENT_MAP)) {
      for (const name of derivation.tags) taxonomyNames.add(name)
    }

    const missing = [...taxonomyNames].filter((name) => !isSystemTag(name))
    expect(missing).toEqual([])
  })

  test("SYSTEM_TAGS is sorted and free of duplicates", () => {
    expect([...SYSTEM_TAGS]).toEqual([...SYSTEM_TAGS].slice().sort())
    expect(new Set(SYSTEM_TAGS).size).toBe(SYSTEM_TAGS.length)
  })

  test("isSystemTag is exact, not fuzzy", () => {
    expect(isSystemTag("Investor")).toBe(true)
    expect(isSystemTag("investor")).toBe(false)
    expect(isSystemTag("Investors")).toBe(false)
    expect(isSystemTag(null)).toBe(false)
    expect(isSystemTag(undefined)).toBe(false)
  })
})
