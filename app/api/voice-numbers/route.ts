import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client unavailable" },
      { status: 500 },
    )
  }

  let numbers: string[] = []
  const inboundRes = await supabaseAdmin
    .from("inbound_numbers")
    .select("e164, enabled")
    .eq("enabled", true)

  if (inboundRes.error) {
    console.warn("Failed to load inbound numbers, falling back", inboundRes.error)
  } else if (inboundRes.data?.length) {
    numbers = inboundRes.data
      .map((row: { e164: string }) => row.e164)
      .filter((val): val is string => Boolean(val))
  }

  if (!numbers.length) {
    const voiceRes = await supabaseAdmin
      .from("voice_numbers")
      .select("phone_number")
    if (voiceRes.error) {
      console.error("Failed to fetch voice numbers", voiceRes.error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }
    numbers = (voiceRes.data || []).map(
      (row: { phone_number: string }) => row.phone_number,
    )
  }

  return NextResponse.json({ numbers })
}
