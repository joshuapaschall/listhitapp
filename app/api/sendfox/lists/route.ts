import { NextRequest } from "next/server"
import { createList } from "@/services/sendfox-service"

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name) {
      return new Response(JSON.stringify({ error: "name required" }), {
        status: 400,
      })
    }
    const list = await createList(name)
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
