import { NextRequest } from "next/server"
import { createList } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../_auth"

export async function POST(req: NextRequest) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(JSON.stringify({ connected: false, error: "SendFox not connected" }), {
        status: 200,
      })
    }

    const { name } = await req.json()
    if (!name) {
      return new Response(JSON.stringify({ error: "name required" }), {
        status: 400,
      })
    }
    const list = await withSendfoxAuth(authContext, async () => createList(name))
    return new Response(
      JSON.stringify({ success: true, id: list?.id }),
    )
  } catch (err: any) {
    console.error("SendFox list create failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}
