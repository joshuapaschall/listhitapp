import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!supabaseAdmin) {
      throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY")
    }

    const { error: queueError } = await supabaseAdmin
      .from("email_campaign_queue")
      .delete()
      .eq("campaign_id", params.id)

    if (queueError) {
      throw queueError
    }

    const { error: recipientError } = await supabaseAdmin
      .from("campaign_recipients")
      .delete()
      .eq("campaign_id", params.id)

    if (recipientError) {
      throw recipientError
    }

    const { error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .delete()
      .eq("id", params.id)

    if (campaignError) {
      throw campaignError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete campaign", error)
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 },
    )
  }
}
