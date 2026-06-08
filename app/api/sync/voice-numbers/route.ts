import { apiError } from "@/lib/api-error"
// /app/api/sync/voice-numbers/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { assertCronAuth } from "@/lib/cron-auth"

async function fetchNumbers() {
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!messagingProfileId) {
    throw new Error(
      "Telnyx messaging profile env var is not set. Refusing to sync without a profile filter " +
      "to prevent pulling in numbers from other Telnyx products on the same account."
    )
  }

  const numbers: any[] = []
  const params = new URLSearchParams({
    "filter[messaging_profile_id]": messagingProfileId,
    "page[number]": "1",
    "page[size]": "100",
  })
  let url: string = `${TELNYX_API_URL}/phone_numbers?${params.toString()}`
  const headers = telnyxHeaders()
  while (url) {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Telnyx request failed: ${res.status}`)
    const data: any = await res.json()
    numbers.push(...(data.data || []))
    url = data.meta?.next_page_url || ""
  }
  return numbers
}

async function upsertNumbers(numbers: any[], supabase: any) {
  const mapped = numbers.map((n) => ({
    phone_number: n.phone_number,
    friendly_name: n.friendly_name || null,
    provider_id: n.id,
    connection_id: n.connection_id || null,
    messaging_profile_id: n.messaging_profile_id || null,
    status: n.status || null,
    tags: n.tags || n.features || null,
  }))

  const { error } = await supabase
    .from("voice_numbers")
    .upsert(mapped, { onConflict: "phone_number" })

  if (error) throw error
}

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")
  const secret = process.env.VOICE_SYNC_SECRET_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl || !getTelnyxApiKey()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 })
  }

  let isAuthorized = Boolean(secret && auth === `Bearer ${secret}`)
  if (!isAuthorized) {
    try {
      assertCronAuth(request)
      isAuthorized = true
    } catch (err) {
      if (err instanceof Response) return err
      throw err
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const numbers = await fetchNumbers()
    await upsertNumbers(numbers, supabase)
    return NextResponse.json({ status: "success", synced: numbers.length })
  } catch (err: any) {
    console.error("Failed to sync voice numbers", err)
    return apiError(err, 500)
  }
}

export const GET = POST
