export const runtime = "nodejs"
import { NextResponse } from "next/server"

import { devBypassAgentAuth } from "@/lib/dev"

export async function POST() {
  if (devBypassAgentAuth) {
    return NextResponse.json({
      ok: true,
      agent: { id: "dev", email: "dev@local", name: "Dev Agent" },
    })
  }
  return NextResponse.json(
    { error: "Supabase handles agent sign-in now" },
    { status: 410 },
  )
}
