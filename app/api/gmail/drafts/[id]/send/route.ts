import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { sendDraft } from "@/services/gmail-api"
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

assertServer()

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied

  try {
    const result = await sendDraft(user.id, params.id)
    return NextResponse.json({
      id: (result as any)?.id || null,
      threadId: (result as any)?.threadId || null,
    })
  } catch (err: any) {
    console.error("Failed to send draft", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
