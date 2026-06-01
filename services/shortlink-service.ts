// services/shortlink-service.ts
//
// Native short link service. Replaces services/shortio-service.ts entirely.
// Backed by the `short_links` table in Supabase. Slugs are nanoid-generated
// from a custom alphabet that omits visually-confusing characters.

import { customAlphabet } from "nanoid"
import { supabaseAdmin as supabase } from "@/lib/supabase"

// Alphabet of 56 chars; omits 0/O/1/l/I to avoid confusion in printed/spoken URLs.
const SLUG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const SLUG_LENGTH = 7

const generateRawSlug = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH)

export function generateSlug(): string {
  return generateRawSlug()
}

function getDefaultDomain(): string {
  const domain = process.env.SHORT_LINK_DEFAULT_DOMAIN
  if (!domain) {
    throw new Error(
      "SHORT_LINK_DEFAULT_DOMAIN is not configured. Set it in env to a short-link branded domain (e.g. go.georgiawholesalehomes.com).",
    )
  }
  return domain
}

export interface CreateShortLinkInput {
  /** The destination URL the short link redirects to. */
  targetUrl: string
  /** Branded domain to host the short link on. Defaults to SHORT_LINK_DEFAULT_DOMAIN env var. */
  domain?: string
  /** Optional custom slug. If omitted, a 7-char random slug is generated. */
  slug?: string
  /** Optional FK to campaigns. */
  campaignId?: string | null
  /** Optional FK to campaign_recipients (enables per-recipient click attribution via the RPC cascade). */
  campaignRecipientId?: string | null
  /** Optional FK to properties. */
  propertyId?: string | null
  /** Optional FK to auth.users (for audit). */
  createdBy?: string | null
  /** Tags for organization / later querying. */
  tags?: string[]
  /** Optional auto-expiry timestamp. */
  expiresAt?: Date | string | null
}

export interface CreatedShortLink {
  id: string
  slug: string
  domain: string
  /** Full URL: https://{domain}/{slug} */
  shortUrl: string
  targetUrl: string
}

/**
 * Create a single short link. Auto-retries up to 5 times on slug collision when no
 * custom slug is provided. If a custom slug is provided and collides, throws immediately.
 */
export async function createShortLink(
  input: CreateShortLinkInput,
): Promise<CreatedShortLink> {
  const domain = (input.domain || getDefaultDomain()).toLowerCase()
  const customSlugProvided = Boolean(input.slug)
  let lastError: unknown = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = input.slug || generateRawSlug()
    const row = {
      slug,
      domain,
      target_url: input.targetUrl,
      campaign_id: input.campaignId ?? null,
      campaign_recipient_id: input.campaignRecipientId ?? null,
      property_id: input.propertyId ?? null,
      created_by: input.createdBy ?? null,
      tags: input.tags || [],
      expires_at:
        input.expiresAt instanceof Date
          ? input.expiresAt.toISOString()
          : input.expiresAt ?? null,
    }

    const { data, error } = await supabase
      .from("short_links")
      .insert(row)
      .select("id, slug, domain, target_url")
      .single()

    if (!error && data) {
      return {
        id: data.id as string,
        slug: data.slug as string,
        domain: data.domain as string,
        shortUrl: `https://${data.domain}/${data.slug}`,
        targetUrl: data.target_url as string,
      }
    }

    // Postgres 23505 = unique_violation. If we generated the slug, retry. If the caller
    // specified a custom slug, the collision is their problem; throw.
    const isCollision = (error as { code?: string } | null)?.code === "23505"
    if (isCollision && !customSlugProvided && attempt < 4) {
      lastError = error
      continue
    }

    throw error || new Error("createShortLink failed with no error object")
  }

  const lastMessage = (lastError as { message?: string } | null)?.message ?? String(lastError)
  throw new Error(
    `createShortLink: 5 collision retries exhausted (last error: ${lastMessage})`,
  )
}

/**
 * Bulk-create short links. Tries one big insert; on collision (23505), retries the
 * entire batch with fresh slugs up to 3 times. After that, falls back to individual
 * createShortLink calls (slower but resilient).
 *
 * Inputs with a `slug` property are excluded from collision retries — if a custom slug
 * collides, that single entry fails and is logged.
 *
 * Returns results in the same order as inputs. Failed entries are returned as null at
 * their position; callers should null-check.
 */
export async function createShortLinksBulk(
  inputs: CreateShortLinkInput[],
): Promise<Array<CreatedShortLink | null>> {
  if (inputs.length === 0) return []

  const defaultDomain = getDefaultDomain()

  // Try bulk insert with whole-batch retry on collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = inputs.map((input) => ({
      slug: input.slug || generateRawSlug(),
      domain: (input.domain || defaultDomain).toLowerCase(),
      target_url: input.targetUrl,
      campaign_id: input.campaignId ?? null,
      campaign_recipient_id: input.campaignRecipientId ?? null,
      property_id: input.propertyId ?? null,
      created_by: input.createdBy ?? null,
      tags: input.tags || [],
      expires_at:
        input.expiresAt instanceof Date
          ? input.expiresAt.toISOString()
          : input.expiresAt ?? null,
    }))

    const { data, error } = await supabase
      .from("short_links")
      .insert(rows)
      .select("id, slug, domain, target_url")

    if (!error && data) {
      // Supabase returns the inserted rows in the same order as the input array.
      return (data as Array<{ id: string; slug: string; domain: string; target_url: string }>).map(
        (d) => ({
          id: d.id,
          slug: d.slug,
          domain: d.domain,
          shortUrl: `https://${d.domain}/${d.slug}`,
          targetUrl: d.target_url,
        }),
      )
    }

    if ((error as { code?: string } | null)?.code !== "23505") {
      // Non-collision DB error: bail out
      throw error
    }

    console.warn(
      `[shortlink-service] Bulk insert collision on attempt ${attempt + 1}/3, regenerating slugs and retrying`,
    )
  }

  // After 3 batch-retry attempts kept colliding, fall back to per-row creates.
  console.warn(
    "[shortlink-service] Bulk batch kept colliding; falling back to individual creates",
  )
  const results: Array<CreatedShortLink | null> = []
  for (const input of inputs) {
    try {
      const result = await createShortLink(input)
      results.push(result)
    } catch (err) {
      console.error("[shortlink-service] Individual fallback create failed:", err)
      results.push(null)
    }
  }
  return results
}

/**
 * Email-flow helper. Replaces URLs (or anchor hrefs only) in an HTML body with native
 * short links. Maintains the API shape of the old shortio-service version so callers
 * (campaign-sender.ts, campaigns/send/route.ts email branch) keep working.
 *
 * NOTE: This does NOT do per-recipient unique links — it creates one shared short link
 * per unique URL in the body. For per-recipient attribution, use createShortLinksBulk
 * directly with campaignRecipientId. The SMS send route uses bulk; email senders can
 * call the bulk helper when per-recipient attribution is required.
 */
export async function replaceUrlsWithShortLinks(
  html: string,
  opts: { anchorHrefOnly?: boolean; campaignId?: string } = {},
): Promise<{ html: string; key: string | null }> {
  if (opts.anchorHrefOnly) {
    return replaceAnchorHrefsWithShortLinks(html, opts.campaignId)
  }
  return replaceAllUrlsWithShortLinks(html, opts.campaignId)
}

async function replaceAnchorHrefsWithShortLinks(
  html: string,
  campaignId?: string,
): Promise<{ html: string; key: string | null }> {
  const anchorRegex = buildAnchorHrefRegex()
  const urls = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html))) {
    urls.add(match[1])
  }
  if (!urls.size) return { html, key: null }

  const replacements = new Map<string, string>()
  let firstKey: string | null = null
  for (const url of urls) {
    try {
      const result = await createShortLink({
        targetUrl: url,
        campaignId: campaignId ?? null,
        tags: campaignId ? [`campaign:${campaignId}`] : [],
      })
      replacements.set(url, result.shortUrl)
      if (!firstKey) firstKey = result.slug
    } catch (err) {
      console.error("[shortlink-service] anchor replacement failed for", url, err)
    }
  }

  const replaceRegex = buildAnchorHrefRegex()
  const newHtml = html.replace(replaceRegex, (fullMatch, url) => {
    const shortUrl = replacements.get(url)
    if (!shortUrl) return fullMatch
    return fullMatch.replace(url, shortUrl)
  })

  return { html: newHtml, key: firstKey }
}

async function replaceAllUrlsWithShortLinks(
  html: string,
  campaignId?: string,
): Promise<{ html: string; key: string | null }> {
  const regex = /(https?:\/\/[^\s"'>]+)/g
  const matches = Array.from(new Set(html.match(regex) || []))
  if (matches.length === 0) return { html, key: null }
  let newHtml = html
  let firstKey: string | null = null
  for (const url of matches) {
    try {
      const result = await createShortLink({
        targetUrl: url,
        campaignId: campaignId ?? null,
        tags: campaignId ? [`campaign:${campaignId}`] : [],
      })
      newHtml = newHtml.split(url).join(result.shortUrl)
      if (!firstKey) firstKey = result.slug
    } catch (err) {
      console.error("[shortlink-service] URL replacement failed for", url, err)
    }
  }
  return { html: newHtml, key: firstKey }
}

function buildAnchorHrefRegex() {
  return /<a\s+[^>]*href=["'](https?:\/\/[^"'>\s]+)["'][^>]*>/gi
}

/**
 * Get the aggregate click count for a slug. Used by the legacy
 * /api/short-links/clicks endpoint.
 */
export async function getShortLinkClicks(slug: string): Promise<number> {
  const { data } = await supabase
    .from("short_links")
    .select("click_count")
    .eq("slug", slug)
    .maybeSingle()
  return ((data?.click_count as number | undefined) ?? 0)
}

export default {
  createShortLink,
  createShortLinksBulk,
  replaceUrlsWithShortLinks,
  getShortLinkClicks,
  generateSlug,
}
