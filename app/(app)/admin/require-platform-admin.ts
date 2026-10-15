import "server-only"

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { isPlatformAdmin } from "@/lib/auth/platform-admin"

// Platform-admin pages don't exist for anyone else: a 404, not a 403, so the
// admin surface isn't discoverable.
export async function requirePlatformAdminPage(): Promise<{ userId: string }> {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isPlatformAdmin(user.id)) notFound()
  return { userId: user.id }
}
