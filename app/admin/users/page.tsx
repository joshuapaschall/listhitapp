import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"
import { revalidatePath } from "next/cache"
import UsersClient from "@/components/admin/users-client"

export const dynamic = "force-dynamic"

async function updateRoleAction(formData: FormData) {
  "use server"
  const userId = formData.get("userId") as string
  const role = formData.get("role") as string
  await fetch("/api/admin/update-role", {
    method: "POST",
    headers: {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    },
    body: JSON.stringify({ userId, role }),
  })
  revalidatePath("/admin/users")
}

export default async function AdminUsersPage() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const role = await getUserRole(supabase)
  if (role !== "admin") {
    return <div className="p-4">Access denied</div>
  }

  const { data } = await supabaseAdmin
    .from("auth.users")
    .select("id,email,created_at,profiles(role)")
    .order("created_at", { ascending: false })

  const rows = data || []

  return (
    <div className="p-6">
      <UsersClient rows={rows as any} />
    </div>
  )
}
