import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { requirePermission } from "@/lib/permissions/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "calls.make_receive")
  if (denied) return denied

  const id = params.id
  const r = await fetch(`${TELNYX_API_URL}/calls/${id}/actions/record_stop`, {
    method: "POST",
    headers: telnyxHeaders(),
  })
  const d = await r.json().catch(() => ({}))
  return NextResponse.json(d, { status: r.status })
}
