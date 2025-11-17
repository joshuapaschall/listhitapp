#!/usr/bin/env ts-node
import "dotenv/config"

import { TELNYX_API_URL, getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env"

const enableFlag = process.env.ENABLE_TELNYX_DEV_TOOLS === "1"

if (!enableFlag) {
  console.log("Telnyx number listing is disabled. Set ENABLE_TELNYX_DEV_TOOLS=1 to enable this helper.")
  process.exit(0)
}

const apiKey = getTelnyxApiKey()
const callControlAppId = getCallControlAppId()

if (!apiKey) {
  console.error("TELNYX_API_KEY is required to query numbers.")
  process.exit(1)
}

interface TelnyxNumber {
  phone_number: string
  status?: string
  connection_id?: string
  tags?: string[]
  messaging_profile_id?: string
}

async function fetchNumbers() {
  const url = new URL(`${TELNYX_API_URL}/phone_numbers`)

  if (callControlAppId) {
    url.searchParams.set("filter[connection_id]", callControlAppId)
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Failed to list Telnyx numbers: ${response.status} ${errorBody}`)
  }

  const payload = (await response.json()) as { data?: TelnyxNumber[] }
  return payload.data ?? []
}

function renderInsert(values: TelnyxNumber[]) {
  if (values.length === 0) {
    console.log("No numbers returned by Telnyx for the current filters.")
    return
  }

  console.log("-- Fill in org_id for each DID before running the insert")
  console.log("insert into public.inbound_numbers (e164, org_id, label) values")

  const lines = values.map(number => {
    const label = number.tags?.[0] || number.status || "Telnyx DID"
    return `  ('${number.phone_number}', '<ORG_ID_HERE>', '${label.replace(/'/g, "''")}')`
  })

  console.log(lines.join(",\n") + ";")
}

async function main() {
  try {
    const numbers = await fetchNumbers()
    renderInsert(numbers)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

void main()
