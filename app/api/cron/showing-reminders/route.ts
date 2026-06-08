import { NextRequest, NextResponse } from "next/server"
import { assertCronAuth } from "@/lib/cron-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendShowingReminder } from "@/lib/showing-notifications"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET (or service-role) bearer enforced via assertCronAuth.
  try {
    assertCronAuth(req)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  const { data: showings, error } = await supabaseAdmin
    .from("showings")
    .select("*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip)")
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", oneHourFromNow.toISOString())

  if (error) {
    console.error("Failed to fetch upcoming showings:", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  let sent = 0
  for (const showing of showings || []) {
    try {
      await sendShowingReminder(showing, showing.buyers, showing.properties)
      await supabaseAdmin.from("showings").update({ reminder_sent: true }).eq("id", showing.id)
      sent++
    } catch (err) {
      console.error(`Failed to send reminder for showing ${showing.id}:`, err)
    }
  }

  return NextResponse.json({ checked: showings?.length || 0, sent })
}

export const GET = POST
