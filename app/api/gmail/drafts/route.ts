import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { listDrafts } from "@/services/gmail-api"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const drafts = await listDrafts(user.id)
    return NextResponse.json({ drafts })
  } catch (err: any) {
    console.error("Failed to list drafts", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
