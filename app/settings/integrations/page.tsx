import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  buildSendfoxContextFromIntegration,
  getDefaultSendfoxContext,
  getSendfoxIntegration,
  withSendfoxAuth,
} from "@/services/sendfox-auth"
import { fetchLists, getContactCount, getMe, listDomains } from "@/services/sendfox-service"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const integration = user ? await getSendfoxIntegration(user.id).catch(() => null) : null
  const envContext = getDefaultSendfoxContext()
  const context = integration ? buildSendfoxContextFromIntegration(integration) : envContext

  if (!context) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <Card>
          <CardHeader className="p-6">
            <CardTitle>SendFox not connected</CardTitle>
            <CardDescription>
              Add a SendFox API token or connect your SendFox account to view integration details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [meResult, domainsResult, listsResult, contactCountResult] = await Promise.all([
    (async () => {
      try {
        return { data: await withSendfoxAuth(context, async () => getMe()), error: null as string | null }
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Failed to load SendFox connection",
        }
      }
    })(),
    (async () => {
      try {
        return {
          data: await withSendfoxAuth(context, async () => listDomains()),
          error: null as string | null,
        }
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Failed to load domains",
        }
      }
    })(),
    (async () => {
      try {
        return {
          data: await withSendfoxAuth(context, async () => fetchLists()),
          error: null as string | null,
        }
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Failed to load lists",
        }
      }
    })(),
    (async () => {
      try {
        return {
          data: await withSendfoxAuth(context, async () => getContactCount()),
          error: null as string | null,
        }
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Failed to load contact count",
        }
      }
    })(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>

      <Card>
        <CardHeader className="p-6">
          <CardTitle>Connection</CardTitle>
          <CardDescription>Current SendFox account status.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {meResult.error ? (
            <p className="text-sm text-destructive">{meResult.error}</p>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Connected</p>
              <p className="text-muted-foreground">Email: {meResult.data?.email ?? "Unknown"}</p>
              <p className="text-muted-foreground">Account ID: {meResult.data?.id ?? "Unknown"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6">
          <CardTitle>Sending Domains</CardTitle>
          <CardDescription>Verified domains available for outbound mail.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {domainsResult.error ? (
            <p className="text-sm text-destructive">{domainsResult.error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(domainsResult.data) ? domainsResult.data : []).map((domain: any) => (
                  <TableRow key={domain.id ?? domain.domain}>
                    <TableCell>{domain.domain ?? "-"}</TableCell>
                    <TableCell className="capitalize">{domain.status ?? "unknown"}</TableCell>
                  </TableRow>
                ))}
                {(!Array.isArray(domainsResult.data) || domainsResult.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No domains found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6">
          <CardTitle>Audience</CardTitle>
          <CardDescription>Overview of contacts and list footprint.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {listsResult.error ? (
            <p className="text-sm text-destructive">{listsResult.error}</p>
          ) : (
            <div className="space-y-1 text-sm">
              <p>Total contacts: {typeof contactCountResult.data === "number" ? `${contactCountResult.data.toLocaleString()} contacts` : "—"}</p>
              <p>Total lists: {Array.isArray(listsResult.data) ? listsResult.data.length : 0}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
