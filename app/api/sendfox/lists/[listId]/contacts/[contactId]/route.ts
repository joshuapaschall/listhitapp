import { NextRequest } from "next/server"
import { removeContactFromList } from "@/services/sendfox-service"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { listId: string; contactId: string } },
) {
  try {
    const listId = Number(params.listId)
    const contactId = Number(params.contactId)
    if (!listId || !contactId) {
      return new Response(JSON.stringify({ error: "invalid ids" }), {
        status: 400,
      })
    }
    await removeContactFromList(listId, contactId)
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    console.error("SendFox remove contact failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}
