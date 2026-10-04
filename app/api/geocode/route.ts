import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { geocodeAddress } from "@/lib/geocode"

export async function POST(request: NextRequest) {
  // Require an authenticated session — this is an internal geocoding helper,
  // not a public proxy.
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { query } = await request.json()
  const result = await geocodeAddress(query)
  return NextResponse.json(result)
}
