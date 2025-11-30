import { NextRequest } from "next/server"
import { loadSendfoxRouteContext } from "../_auth"
import { upsertContact } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"

export async function POST(req: NextRequest) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(JSON.stringify({ connected: false, error: "SendFox not connected" }), {
        status: 200,
      })
    }

    const body = await req.json()
    const email = (body?.email || "").trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400 })
    }

    let lists = Array.isArray(body?.lists) ? body.lists : []
    if ((!lists || lists.length === 0) && process.env.SENDFOX_DEFAULT_LIST_ID) {
      lists = [Number(process.env.SENDFOX_DEFAULT_LIST_ID)]
    }
    if (!Array.isArray(lists) || lists.some((n: any) => !Number.isInteger(Number(n)))) {
      return new Response(JSON.stringify({ error: "lists must be array of integers" }), { status: 400 })
    }

    const contact = await withSendfoxAuth(authContext, async () =>
      upsertContact(
        email,
        body?.first_name,
        body?.last_name,
        lists.map((n: any) => Number(n)),
        body?.tags,
        body?.ip_address,
      ),
    )

    return new Response(JSON.stringify({ id: contact?.id ?? null, connected: true }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 })
  }
}
