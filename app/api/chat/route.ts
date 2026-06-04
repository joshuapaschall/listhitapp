import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import openaiService from "@/services/openai-service"

interface ChatMessage {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 })

  try {
    const { messages } = await req.json()
    if (
      !Array.isArray(messages) ||
      !messages.every(
        (m: any) => m && typeof m.role === "string" && typeof m.content === "string",
      )
    ) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 })
    }
    if (messages.length > 20) {
      return NextResponse.json({ error: "too many messages" }, { status: 400 })
    }
    const charCount = messages.reduce((sum: number, m: ChatMessage) => sum + m.content.length, 0)
    if (charCount > 8000) {
      return NextResponse.json({ error: "messages too long" }, { status: 400 })
    }

    const content = await openaiService.chat(messages)
    return NextResponse.json({ content })
  } catch (err: any) {
    console.error("Chat API error", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
