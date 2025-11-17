import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifyTelnyxRequest } from "@/lib/telnyx"

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifyTelnyxRequest(request, raw)) {
    return new Response("Invalid signature", { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  const payload = body?.data?.payload
  console.log(">>>>>>>>> status <<<<<<<<<");
  console.dir(payload);
  console.log(">>>>>>>>> status <<<<<<<<<");
  const messageId = payload?.id as string | undefined
  const status = payload?.status as string | undefined
  const errorDetail = payload?.errors?.[0]?.detail as string | undefined

  if (!messageId || !status) {
    return new Response("Missing params", { status: 400 })
  }

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (errorDetail) {
    updates.error = errorDetail
  } else if (status === "failed" || status === "undelivered") {
    updates.error = status
  }

  const { error, count } = await supabase
    .from("campaign_recipients")
    .update(updates)
    .eq("provider_id", messageId)
    .select("*", { count: "exact", head: true })

  if (count === 0) {
    console.warn(
      "⚠️ No matching campaign_recipients record found for MessageSid:",
      messageId,
    )
  }

  if (error) {
    console.error("❌ Failed to update campaign recipient:", error)
    return new Response("Error", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
