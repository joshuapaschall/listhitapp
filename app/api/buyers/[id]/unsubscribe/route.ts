import { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import {
  unsubscribe as sendfoxUnsubscribe,
  findContactByEmail,
  removeContactFromList,
} from "@/services/sendfox-service"
import { createLogger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const log = createLogger("unsubscribe-buyer-route")

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const { data: buyer, error } = await supabaseAdmin
      .from("buyers")
      .select("email")
      .eq("id", id)
      .single()
    if (error) throw error

    if (buyer?.email) {
      try {
        const contact = await findContactByEmail(buyer.email)
        if (contact?.id) {
          const { data: groups } = await supabaseAdmin
            .from("buyer_groups")
            .select("groups(sendfox_list_id)")
            .eq("buyer_id", id)
          const listIds = Array.from(
            new Set(
              (groups || [])
                .map((g: any) => g.groups?.sendfox_list_id)
                .filter(Boolean),
            ),
          )
          for (const listId of listIds) {
            await removeContactFromList(listId, contact.id)
          }
        }
        const resp = await sendfoxUnsubscribe(buyer.email)
        console.log("SendFox unsubscribe", { id, email: buyer.email, resp })
        log("info", "sendfox unsubscribe", { id, email: buyer.email, resp })
      } catch (err) {
        console.error("SendFox unsubscribe failed", { id, email: buyer.email, err })
        log("error", "sendfox unsubscribe failed", { id, email: buyer.email, err })
      }
    }

    const { error: upd } = await supabaseAdmin
      .from("buyers")
      .update({ can_receive_sms: false, can_receive_email: false })
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

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  return POST(req, ctx)
}
