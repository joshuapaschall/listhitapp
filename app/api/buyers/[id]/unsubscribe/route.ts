import { NextRequest } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"
import { createLogger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const log = createLogger("unsubscribe-buyer-route")

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })
    }

    const { data: buyer, error } = await supabase
      .from("buyers")
      .select("email")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error

    if (!buyer) {
      return new Response(JSON.stringify({ error: "Buyer not found" }), {
        status: 404,
      })
    }


    const { error: upd } = await supabase
      .from("buyers")
      .update({
        can_receive_sms: false,
        can_receive_email: false,
        email_suppressed: true,
      })
      .eq("id", id)
    console.log("Supabase unsubscribe update", { id, error: upd })
    if (upd) throw upd

    log("info", "buyer unsubscribed", { id })
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    log("error", "unsubscribe route error", { id, err })
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: 500,
    })
  }
}

// TODO: Revisit GET-triggering-unsubscribe because it performs a state-changing action.
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  return POST(req, ctx)
}
