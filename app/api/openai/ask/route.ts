import { NextRequest, NextResponse } from "next/server"
import openaiService from "@/services/openai-service"

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key not configured")
}

export async function POST(req: NextRequest) {
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
