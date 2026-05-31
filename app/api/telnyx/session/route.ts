import { NextRequest } from "next/server"

// In-memory storage for session IDs (in production, use Redis or database)
// Use a global to persist across module reloads in development
const globalForSessionId = globalThis as unknown as {
  telnyxSessionId: string | null
}

if (!globalForSessionId.telnyxSessionId) {
  globalForSessionId.telnyxSessionId = null
}

let currentSessionId = globalForSessionId.telnyxSessionId

export async function POST(request: NextRequest) {
  console.log("📥 Session ID POST request received")
  try {
    const body = await request.json()
    console.log("📦 Request body:", body)
    
    const { sessionId } = body
    
    if (!sessionId) {
      console.log("❌ No session ID provided")
      return Response.json({ error: "Session ID required" }, { status: 400 })
    }
    
    currentSessionId = sessionId
    globalForSessionId.telnyxSessionId = sessionId
    console.log("✅ Session ID stored successfully:", sessionId)
    
    return Response.json({ success: true })
  } catch (err) {
    console.error("❌ Error storing session ID:", err)
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function GET() {
  console.log("📥 Session ID GET request - current value:", currentSessionId)
  return Response.json({ sessionId: currentSessionId })
}