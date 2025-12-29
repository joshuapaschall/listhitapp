import { NextRequest, NextResponse } from "next/server"
import { assertCronAuth } from "@/lib/cron-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { syncGmailThreads } from "@/scripts/gmail-sync"
import { assertServer } from "@/utils/assert-server"

assertServer()

const FIVE_MINUTES_MS = 5 * 60 * 1000
const DEFAULT_MAX_RESULTS = 100
const DEFAULT_FOLDER = "inbox"
const DEFAULT_LIMIT_USERS = 10

export async function POST(req: NextRequest) {
  try {
    assertCronAuth(req)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.userId === "string" ? body.userId : undefined
  const maxResults =
    typeof body?.maxResults === "number" && body.maxResults > 0
      ? body.maxResults
      : DEFAULT_MAX_RESULTS
  const folder =
    typeof body?.folder === "string" && body.folder.trim().length > 0 ? body.folder : DEFAULT_FOLDER
  const limitUsers =
    typeof body?.limitUsers === "number" && body.limitUsers > 0
      ? body.limitUsers
      : DEFAULT_LIMIT_USERS

  const fiveMinutesAgo = new Date(Date.now() - FIVE_MINUTES_MS).toISOString()
  let targetUserIds: string[] = []

  if (userId) {
    const { data, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
      .from("gmail_tokens")
      .select("user_id,last_synced_at")
      .eq("sync_enabled", true)
      .or(`last_synced_at.is.null,last_synced_at.lt.${fiveMinutesAgo}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(limitUsers)

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 })
    }

    targetUserIds = (data || []).map((row) => row.user_id)
  }

  const failures: { userId: string; error: string }[] = []
  let totalThreadsSynced = 0

  for (const id of targetUserIds) {
    const syncTimestamp = new Date().toISOString()
    try {
      const synced = await syncGmailThreads(id, maxResults, folder)
      totalThreadsSynced += synced
      const { error: updateError } = await supabaseAdmin
        .from("gmail_tokens")
        .update({
          last_synced_at: syncTimestamp,
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
      await supabaseAdmin
        .from("gmail_tokens")
        .update({
          last_sync_error: message,
          last_sync_error_at: syncTimestamp,
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
