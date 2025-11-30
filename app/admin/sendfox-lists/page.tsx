import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { getUserRole } from "@/lib/get-user-role"
import { fetchLists, reconcileSendfoxList, type SendFoxList } from "@/services/sendfox-service"
import {
  buildSendfoxContextFromIntegration,
  getDefaultSendfoxContext,
  getSendfoxIntegration,
  withSendfoxAuth,
} from "@/services/sendfox-auth"
import ErrorToast from "./error-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function resyncListAction(formData: FormData) {
  "use server"
  const id = Number(formData.get("id"))
  const mode = (formData.get("mode") as string) || "preview"
  if (id) {
    await reconcileSendfoxList(id, { dryRun: mode !== "apply" })
  }
  revalidatePath("/admin/sendfox-lists")
}

export default async function AdminSendFoxListsPage() {
  const devBypass = process.env.NEXT_PUBLIC_DEV_MODE === "1"
  if (!devBypass) {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const role = await getUserRole(supabase)
    if (role !== "admin") {
      return <div className="p-4">You must be an admin to view this page.</div>
    }
  }

  let lists: SendFoxList[] = []
  let error: string | null = null
  let authReady = false
  try {
    const { data: session } = await supabase.auth.getUser()
    const integration = session?.user
      ? await getSendfoxIntegration(session.user.id).catch(() => null)
      : null
    const context = integration
      ? buildSendfoxContextFromIntegration(integration)
      : getDefaultSendfoxContext()

    if (!context) {
      error = "Connect SendFox to view lists"
    } else {
      authReady = true
      lists = await withSendfoxAuth(context, async () => fetchLists())
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "An unexpected error occurred"
  }

  const syncError = error || lists.find((l) => l.last_sync_status === "error")?.last_sync_message

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">SendFox Lists</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>CRM Group</TableHead>
            <TableHead>Sync Status</TableHead>
            <TableHead className="w-[220px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => (
            <TableRow key={list.id}>
              <TableCell>{list.name}</TableCell>
              <TableCell>{list.contact_count}</TableCell>
              <TableCell>{new Date(list.created_at).toLocaleDateString()}</TableCell>
              <TableCell>{list.group?.name || "-"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="font-medium capitalize">
                    {list.last_sync_status ? list.last_sync_status.replace("_", " ") : "n/a"}
                    {list.pending_mismatches ? ` • ${list.pending_mismatches} pending` : ""}
                  </div>
                  {list.last_sync_at ? (
                    <div className="text-muted-foreground">
                      {new Date(list.last_sync_at).toLocaleString()}
                    </div>
                  ) : null}
                  {list.last_sync_message ? (
                    <div className="text-destructive text-xs">{list.last_sync_message}</div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <form action={resyncListAction} className="flex gap-2">
                  <input type="hidden" name="id" value={list.id} />
                  <Button type="submit" size="sm" variant="outline" name="mode" value="preview">
                    🧪 Preview Diff
                  </Button>
                  <Button type="submit" size="sm" variant="default" name="mode" value="apply">
                    🔁 Apply Sync
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ErrorToast message={syncError} />
      {!authReady && !error ? (
        <p className="text-sm text-muted-foreground mt-4">SendFox is not connected.</p>
      ) : null}
    </div>
  )
}
