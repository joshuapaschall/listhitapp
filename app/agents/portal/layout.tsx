export const dynamic = "force-dynamic"
export const revalidate = 0

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"

import { devBypassAgentAuth } from "@/lib/dev"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (devBypassAgentAuth) {
    return <>{children}</>
  }

  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect("/agents/login")

  return <>{children}</>
}
