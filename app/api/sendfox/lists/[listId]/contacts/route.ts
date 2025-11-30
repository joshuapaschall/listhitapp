import { NextRequest } from "next/server"
import { addContactToList, fetchListContacts } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../../_auth"

export async function POST(req: NextRequest, { params }: { params: { listId: string } }) {
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
    const body = await req.json()
    const { email, first_name, last_name } = body
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
      })
    }
    const contact = await withSendfoxAuth(authContext, async () =>
      addContactToList(listId, { email, first_name, last_name }),
    )
    return new Response(JSON.stringify({ success: true, id: contact?.id }))
  } catch (err: any) {
    console.error("SendFox add contact failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { listId: string } }) {
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
    const contacts = await withSendfoxAuth(authContext, async () => fetchListContacts(listId))
    return new Response(JSON.stringify(contacts || []))
  } catch (err: any) {
    console.error("SendFox contacts fetch failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}
