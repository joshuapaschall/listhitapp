import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("voice_numbers")
    .select("phone_number")

  if (error) {
    console.error("Failed to fetch voice numbers", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const numbers = (data || []).map((row: { phone_number: string }) => row.phone_number)
  return NextResponse.json({ numbers })
}
