import { createClient } from "@supabase/supabase-js"
import { getSiteTemplate, PERSONAS } from "@/lib/site-builder/templates"
import { EXTRA_PAGES } from "@/lib/site-builder/extra-pages"

const APPLY = process.argv.includes("--apply")

const OLD_STATS = new Set([
  "1,200+ active buyers on the list",
  "$42M+ in deals moved",
  "Acreage & lots added weekly",
  "Trusted by 2,400+ cash buyers",
])

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// Insert a missing block at its canonical spot: before the first existing block
// that comes after it in canonical order; else append.
function insertIndex(content: any[], canonTypes: string[], type: string): number {
  const my = canonTypes.indexOf(type)
  for (let j = 0; j < content.length; j++) {
    if (canonTypes.indexOf(content[j]?.type) > my) return j
  }
  return content.length
}

async function fetchAllSites() {
  const rows: any[] = []
  const size = 500
  for (let from = 0; ; from += size) {
    const { data, error } = await db
      .from("sites")
      .select("id, org_id, persona, template_id")
      .order("created_at", { ascending: true })
      .range(from, from + size - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < size) break
  }
  return rows
}

async function main() {
  console.log(APPLY ? "=== BACKFILL — APPLYING CHANGES ===" : "=== BACKFILL — DRY RUN (no writes) ===")
  const sites = await fetchAllSites()
  let statFixes = 0, blockInserts = 0, pagesCreated = 0, changedSites = 0

  for (const site of sites) {
    const tpl = getSiteTemplate(site.template_id) || getSiteTemplate("marquee")
    if (!tpl) continue
    const canonical = tpl.build(site.persona)
    const canonTypes: string[] = (canonical.content || []).map((b: any) => b.type)

    const { data: home } = await db
      .from("site_pages").select("*").eq("site_id", site.id).eq("path", "/").maybeSingle()
    if (!home) continue

    const puck = clone(home.puck_data || {})
    const content: any[] = Array.isArray(puck.content) ? puck.content : []
    const existing = new Set(content.map((b) => b?.type))
    const notes: string[] = []

    // 1) Hero stat fix (only when still an old default)
    const hero = content.find((b) => b?.type === "Hero")
    const newStat = PERSONAS[site.persona as keyof typeof PERSONAS]?.stat
    if (hero && newStat && OLD_STATS.has(hero.props?.stat)) {
      notes.push(`stat: "${hero.props.stat}" -> "${newStat}"`)
      hero.props.stat = newStat
      statFixes++
    }

    // 2) Insert missing canonical blocks (additive; no reorder of existing)
    const added: string[] = []
    for (const cb of canonical.content as any[]) {
      if (existing.has(cb.type)) continue
      content.splice(insertIndex(content, canonTypes, cb.type), 0, clone(cb))
      existing.add(cb.type)
      added.push(cb.type)
    }
    if (added.length) { notes.push(`blocks added: ${added.join(", ")}`); blockInserts += added.length }

    puck.content = content
    const homeChanged = notes.length > 0
    if (homeChanged && APPLY) {
      const { error } = await db.from("site_pages").update({ puck_data: puck }).eq("id", home.id)
      if (error) { console.error(`  ! ${site.id} home update failed: ${error.message}`); continue }
    }

    // 3) Extra sub-pages (create if missing) — shared canonical list, so new
    // sites and backfilled sites seed identical pages with the same defaults.
    const createdPaths: string[] = []
    for (const e of EXTRA_PAGES) {
      const { data: row } = await db
        .from("site_pages").select("id").eq("site_id", site.id).eq("path", e.path).maybeSingle()
      if (row) continue
      if (APPLY) {
        const { error } = await db.from("site_pages").insert({
          site_id: site.id, org_id: site.org_id, path: e.path, title: e.title,
          meta_description: null, puck_data: e.build(puck, site.persona),
          nav_label: e.navLabel, sort_order: e.sortOrder, enabled: e.enabledByDefault,
        })
        if (error) { console.error(`  ! ${site.id} ${e.path} insert failed: ${error.message}`); continue }
      }
      createdPaths.push(e.path)
    }
    if (createdPaths.length) { notes.push(`pages created: ${createdPaths.join(", ")}`); pagesCreated += createdPaths.length }

    if (notes.length) {
      changedSites++
      console.log(`• ${site.id} (${site.persona}): ${notes.join(" | ")}`)
    }
  }

  console.log("---")
  console.log(`Scanned ${sites.length} sites. Sites changed: ${changedSites}. Stat fixes: ${statFixes}. Blocks added: ${blockInserts}. Pages created: ${pagesCreated}.`)
  if (!APPLY) console.log("DRY RUN — nothing was written. Re-run with --apply to apply.")
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
