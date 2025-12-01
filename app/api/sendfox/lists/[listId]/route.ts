import { NextRequest } from "next/server"
import { deleteList } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../../_auth"

export async function DELETE(_req: NextRequest, { params }: { params: { listId: string } }) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(JSON.stringify({ connected: false, error: "SendFox not connected" }), {
        status: 200,
      })
    }

    const listId = Number(params.listId)
    if (!listId) {
      return new Response(JSON.stringify({ error: "invalid list id" }), {
        status: 400,
      })
    }
    await withSendfoxAuth(authContext, async () => deleteList(listId))
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    console.error("SendFox list delete failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}
