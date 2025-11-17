import { NextRequest } from "next/server"
import { getSendfoxToken } from "@/lib/sendfox-env"

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email")
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
      })
    }
    const token = getSendfoxToken()
    const resp = await fetch(
      `https://api.sendfox.com/contacts?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    )
    const data = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data.error || data.message || "error" }), {
        status: resp.status,
      })
    }
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: 500,
    })
  }
}
