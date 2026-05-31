import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "settings.integrations")
  if (denied) return denied

  return Response.json({
    listId: process.env.SENDFOX_DEFAULT_LIST_ID ? Number(process.env.SENDFOX_DEFAULT_LIST_ID) : null,
  })
}
