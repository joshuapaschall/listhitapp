import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  const { data: site } = await supabase
    .from("sites")
    .select("id, slug, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  if (site.status !== "published") {
    return NextResponse.json({ error: "Site is not published" }, { status: 409 })
  }

  try {
    const apiKey = process.env.APIFLASH_ACCESS_KEY
    if (!apiKey) throw new Error("APIFLASH_ACCESS_KEY is not set")

    // ?preview=screenshot suppresses the owner's pixels client-side; no_tracking
    // blocks trackers at the network level too. fresh=true bypasses ApiFlash's
    // cache so each re-publish captures the current content.
    const target = `https://${site.slug}.listhit.io?preview=screenshot`
    const params = new URLSearchParams({
      access_key: apiKey,
      url: target,
      format: "png",
      width: "1280",
      height: "800",
      wait_until: "network_idle",
      no_tracking: "true",
      no_cookie_banners: "true",
      fresh: "true",
    })

    const shotRes = await fetch(`https://api.apiflash.com/v1/urltoimage?${params.toString()}`)
    if (!shotRes.ok) throw new Error(`ApiFlash responded ${shotRes.status}`)
    const buffer = Buffer.from(await shotRes.arrayBuffer())

    // Storage write uses the admin client; the path is overwritten each capture.
    const path = `thumbnails/${id}.png`
    await supabaseAdmin.storage
      .from("site-assets")
      .upload(path, buffer, { contentType: "image/png", upsert: true })
    const { data: pub } = supabaseAdmin.storage.from("site-assets").getPublicUrl(path)
    const thumbnailUrl = `${pub.publicUrl}?v=${Date.now()}`

    // Session-backed, org-scoped DB update.
    await supabase
      .from("sites")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", id)
      .eq("org_id", orgId)

    return NextResponse.json({ thumbnailUrl })
  } catch (err) {
    console.error("[thumbnail] capture failed", { siteId: id }, err)
    return NextResponse.json({ error: "Failed to capture thumbnail" }, { status: 500 })
  }
}
