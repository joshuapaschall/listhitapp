import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

async function togglePermissionAction(formData: FormData) {
  "use server"
  const userId = formData.get("userId") as string
  const key = formData.get("key") as string
  const granted = formData.get("granted") === "true"
  await fetch("/api/admin/update-permission", {
    method: "POST",
    headers: {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    },
    body: JSON.stringify({ userId, permissionKey: key, granted }),
  })
  revalidatePath("/admin/permissions")
}

export default async function AdminPermissionsPage() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const role = await getUserRole(supabase)
  if (role !== "admin") {
    return <div className="p-4">Access denied</div>
  }

  const { data } = await supabaseAdmin
    .from("permissions")
    .select("id,user_id,permission_key,granted,auth.users(email)")
    .order("permission_key", { ascending: true })

  const rows = data || []

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Permissions</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.auth?.email}</TableCell>
              <TableCell>{row.permission_key}</TableCell>
              <TableCell>{row.granted ? "Yes" : "No"}</TableCell>
              <TableCell>
                <form action={togglePermissionAction}>
                  <input type="hidden" name="userId" value={row.user_id} />
                  <input type="hidden" name="key" value={row.permission_key} />
                  <input type="hidden" name="granted" value={!row.granted} />
                  <button className="text-blue-600 hover:underline" type="submit">
                    Toggle
                  </button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
