import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { getMessagingProfilePoolSize } from "@/lib/messaging-throughput"

export const runtime = "nodejs"

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { poolSize, source } = await getMessagingProfilePoolSize()
  const perNumberMpm = Number(process.env.NEXT_PUBLIC_LISTHIT_PER_NUMBER_MPM) || 2

  return NextResponse.json({ poolSize, perNumberMpm, source })
}
