export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { cleanupCredentials } from "@/lib/telnyx/credentials";

export async function GET() {
  return new Response(JSON.stringify({ message: "Use POST" }), {
    status: 405,
    headers: { Allow: "POST" },
  })
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const expectedToken = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || !authHeader.startsWith("Bearer ") || !expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    if (token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const count = await cleanupCredentials()
    return new Response(JSON.stringify({ deleted: count }))
  } catch (err: any) {
    console.error("Failed to cleanup credentials", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
