import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

export async function DELETE() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "settings.integrations")
  if (denied) return denied

  return new Response(
    JSON.stringify({
      error:
        "SendFox does not support DELETE; use POST /api/sendfox/contact with Deleted list",
    }),
    { status: 405 },
  )
}
