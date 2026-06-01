import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasPermission } from "@/lib/permissions/server"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const allowed = await hasPermission(supabase, "settings.integrations")
  if (!allowed) {
    return (
      <div className="max-w-4xl space-y-2 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this settings area.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
      <Card>
        <CardHeader className="p-6">
          <CardTitle>No integrations</CardTitle>
          <CardDescription>
            There are no active third-party integrations configured here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
