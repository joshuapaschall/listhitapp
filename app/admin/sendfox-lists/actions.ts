"use server"

import { reconcileSendfoxList } from "@/services/sendfox-service"
import { revalidatePath } from "next/cache"

export async function resyncListAction(formData: FormData) {
  const id = Number(formData.get("id"))
  const mode = (formData.get("mode") as string) || "preview"
  if (id) {
    await reconcileSendfoxList(id, { dryRun: mode !== "apply" })
  }
  revalidatePath("/admin/sendfox-lists")
}
