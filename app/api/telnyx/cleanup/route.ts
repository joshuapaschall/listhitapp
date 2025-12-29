export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth"
import { cleanupCredentials } from "@/lib/telnyx/credentials";

export async function GET() {
  return new Response(JSON.stringify({ message: "Use POST" }), {
    status: 405,
    headers: { Allow: "POST" },
  })
}

export async function POST(req: NextRequest) {
  const authResponse = requireCronAuth(req)
  if (authResponse) return authResponse

  try {
    const count = await cleanupCredentials()
    return new Response(JSON.stringify({ deleted: count }))
  } catch (err: any) {
    console.error("Failed to cleanup credentials", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
