import { NextRequest } from "next/server"
import { loadSendfoxRouteContext } from "../_auth"
import { findContactByEmail } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"

export async function GET(req: NextRequest) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(
        JSON.stringify({ connected: false, error: "SendFox account not connected" }),
        { status: 200 },
      )
    }

    const email = req.nextUrl.searchParams.get("email")
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
      })
    }
    const data = await withSendfoxAuth(authContext, async () => findContactByEmail(email))
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: 500,
    })
  }
}
