import { createClient } from "@supabase/supabase-js"

import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"

interface TelnyxNumber {
  phone_number: string
  connection_id?: string | null
  messaging_profile_id?: string | null
  tags?: string[] | null
  features?: string[] | null
}

async function fetchAllNumbers(): Promise<TelnyxNumber[]> {
  const numbers: TelnyxNumber[] = []
  const apiKey = getTelnyxApiKey()
  if (!apiKey) throw new Error("TELNYX_API_KEY is not set")
  let url = `${TELNYX_API_URL}/phone_numbers?page[number]=1&page[size]=100`
  const headers = { Authorization: `Bearer ${apiKey}` }

  while (url) {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Telnyx request failed: ${res.status}`)
    const data: any = await res.json()
    numbers.push(...(data.data || []))
    url = data.meta?.next_page_url || ""
  }

  return numbers
}

async function upsertNumbers(numbers: TelnyxNumber[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required")
  }
  const supabase = createClient(url, key)

  for (const num of numbers) {
    const { error } = await supabase
      .from("voice_numbers")
      .upsert(
        {
          phone_number: num.phone_number,
          connection_id: num.connection_id || null,
          messaging_profile_id: num.messaging_profile_id || null,
          tags: num.tags || num.features || null,
        },
        { onConflict: "phone_number" },
      )
    if (error) {
      console.error("Failed to upsert", num.phone_number, error)
    }
  }
}

async function main() {
  if (!getTelnyxApiKey()) {
    console.error("TELNYX_API_KEY is not set")
    process.exit(1)
  }

  const numbers = await fetchAllNumbers()
  await upsertNumbers(numbers)
  console.log(`Synced ${numbers.length} numbers`)
}

main()
