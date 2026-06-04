import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import openaiService from "@/services/openai-service"

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 })

  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt required" }, { status: 400 })
    }
    const result = await openaiService.generateCopy(prompt)
    return NextResponse.json({ result })
  } catch (err) {
    console.error("OpenAI ask error", err)
    return NextResponse.json({ error: "Failed to call OpenAI" }, { status: 500 })
  }
}
