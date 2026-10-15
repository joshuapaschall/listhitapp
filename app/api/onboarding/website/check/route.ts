import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { checkUrlLoads, normalizeHttpsUrl } from "@/lib/onboarding/url-check"

export const dynamic = "force-dynamic"

// Live "does this page open?" check for the website step's URL fields.
export async function POST(request: Request) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const body = await request.json().catch(() => null)
  const url = normalizeHttpsUrl(body?.url)
  if (!url) return NextResponse.json({ ok: false, error: "Enter a full web address, like https://yourbrand.com" })
  const result = await checkUrlLoads(url)
  return NextResponse.json({ ok: result.ok, url, ...(result.ok ? {} : { error: "We couldn't open this page" }) })
}
