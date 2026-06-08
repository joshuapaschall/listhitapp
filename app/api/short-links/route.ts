import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { createShortLink } from "@/services/shortlink-service"

export async function POST(request: NextRequest) {
  // Creating short links requires an authenticated session.
  const { user } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { originalURL, path: customSlug } = body as {
      originalURL?: string
      path?: string
    }

    if (!originalURL) {
      return NextResponse.json(
        { error: "originalURL required" },
        { status: 400 },
      )
    }

    const result = await createShortLink({
      targetUrl: originalURL,
      slug: customSlug || undefined,
    })

    // Maintain back-compat response shape with the old Short.io-backed endpoint.
    return NextResponse.json({
      shortURL: result.shortUrl,
      path: result.slug,
      idString: result.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create short link"
    console.error("[/api/short-links] create failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
