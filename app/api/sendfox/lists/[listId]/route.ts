import { NextRequest } from "next/server"
import { deleteList } from "@/services/sendfox-service"

export async function DELETE(_req: NextRequest, { params }: { params: { listId: string } }) {
  try {
    const listId = Number(params.listId)
    if (!listId) {
      return new Response(JSON.stringify({ error: "invalid list id" }), {
        status: 400,
      })
    }
    await deleteList(listId)
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    console.error("SendFox list delete failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: err.status || 500,
    })
  }
}
