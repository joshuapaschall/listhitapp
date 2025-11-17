import { listThreads } from "./gmail-api"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const supabase = supabaseAdmin

export async function getGmailMetrics(userId: string) {
  const threads = await listThreads(userId, 50, "inbox")
  let count = 0
  for (const t of threads) {
    const first = (t as any).messages?.[0]
    const headers = first?.payload?.headers || []
    const from = headers.find((h: any) => h.name === "From")?.value || ""
    if (/mailer-daemon/i.test(from)) {
      const match = (t.snippet || "").match(/<([^>]+@[^>]+)>/)
      const email = match ? match[1].toLowerCase() : null
      if (!email) continue
      const { data: buyer } = await supabase
        .from("buyers")
        .select("id")
        .eq("email_norm", email)
        .maybeSingle()
      if (buyer?.id) {
        await supabase
          .from("campaign_recipients")
          .update({ bounced_at: new Date().toISOString() })
          .eq("buyer_id", buyer.id)
          .is("bounced_at", null)
        count++
      }
    }
  }
  return count
}
