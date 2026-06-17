import { NextResponse } from "next/server"
import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"
import { requireOrgContext } from "@/lib/auth/org-context"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

async function launchBrowser() {
  // Local dev: point at a locally installed Chrome via LOCAL_CHROME_PATH so the
  // route is testable on a laptop. Production/Vercel: use the bundled binary.
  if (process.env.NODE_ENV === "development" && process.env.LOCAL_CHROME_PATH) {
    return puppeteer.launch({
      executablePath: process.env.LOCAL_CHROME_PATH,
      headless: true,
      defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    })
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  })
}

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

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.goto(`https://${site.slug}.listhit.io?preview=screenshot`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    })
    const buffer = (await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })) as Buffer
    await browser.close()
    browser = null

    // Storage writes use the admin client; the path is overwritten each capture.
    const path = `thumbnails/${id}.png`
    await supabaseAdmin.storage
      .from("site-assets")
      .upload(path, buffer, { contentType: "image/png", upsert: true })
    const { data: pub } = supabaseAdmin.storage.from("site-assets").getPublicUrl(path)
    const thumbnailUrl = `${pub.publicUrl}?v=${Date.now()}`

    // The URL write is a session-backed, org-scoped DB update.
    await supabase
      .from("sites")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", id)
      .eq("org_id", orgId)

    return NextResponse.json({ thumbnailUrl })
  } catch (err) {
    console.error("[thumbnail] capture failed", { siteId: id }, err)
    // Sanitize: never leak the underlying error. Capture is fire-and-forget.
    if (browser) {
      try {
        await browser.close()
      } catch {
        /* already gone */
      }
    }
    return NextResponse.json({ error: "Failed to capture thumbnail" }, { status: 500 })
  }
}
