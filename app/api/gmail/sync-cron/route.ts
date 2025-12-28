import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { syncGmailThreads } from "@/scripts/gmail-sync"

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || ""
  if (!header.toLowerCase().startsWith("bearer ")) return null
  return header.slice(7)
}

function getSupabaseAdminClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const { CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const supabase = getSupabaseAdminClient()
  if (!supabase || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 })
  }

  const token = getBearerToken(req)
  const allowedTokens = [CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY].filter(Boolean)
  if (!token || !allowedTokens.includes(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { batchSize = 5, maxResults = 100, folder = "inbox", userId } =
    (await req.json().catch(() => ({}))) || {}

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  let targetUserIds: string[] = []

  if (userId) {
    const { data, error } = await supabase
      .from("gmail_tokens")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load user" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    targetUserIds = [data.user_id]
  } else {
    const { data, error } = await supabase
      .from("gmail_tokens")
      .select("user_id")
      .eq("sync_enabled", true)
      .or(`last_synced_at.is.null,last_synced_at.lt.${fiveMinutesAgo}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(batchSize)

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 })
    }

    targetUserIds = (data || []).map((row) => row.user_id)
  }

  const failures: { userId: string; error: string }[] = []
  let totalThreadsSynced = 0

  for (const id of targetUserIds) {
    try {
      const synced = await syncGmailThreads(id, maxResults, folder)
      totalThreadsSynced += synced
      const { error: updateError } = await supabase
        .from("gmail_tokens")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_error: null,
          last_sync_error_at: null,
        })
        .eq("user_id", id)
      if (updateError) {
        failures.push({ userId: id, error: updateError.message || "Failed to update sync state" })
      }
    } catch (err: any) {
      const message = err?.message || "Failed to sync user"
      failures.push({ userId: id, error: message })
      await supabase
        .from("gmail_tokens")
        .update({
          last_sync_error: message,
          last_sync_error_at: new Date().toISOString(),
        })
        .eq("user_id", id)
    }
  }

  return NextResponse.json({
    processedUsers: targetUserIds.length,
    totalThreadsSynced,
    failures,
  })
}

export function GET() {
  return NextResponse.json(
    { message: "Use POST to sync Gmail threads" },
    { status: 405, headers: { Allow: "POST" } },
  )
}
