import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { SLUG_LENGTH } from "@/services/shortlink-service"

export const runtime = "nodejs"

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Single env domain today; swap to a per-org lookup here when custom short
  // domains ship (Phase H). Length math is domain-driven, so nothing else changes.
  const domain = process.env.SHORT_LINK_DEFAULT_DOMAIN || ""

  return NextResponse.json({
    domain,
    slugLength: SLUG_LENGTH,
    configured: Boolean(domain),
  })
}
