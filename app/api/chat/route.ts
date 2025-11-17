import { NextRequest, NextResponse } from "next/server"
import openaiService from "@/services/openai-service"

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key not configured")
}

interface ChatMessage {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
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
