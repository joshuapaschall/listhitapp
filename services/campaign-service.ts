import { supabase } from "@/lib/supabase"


interface CampaignFilters {
  tags?: string[]
  locations?: string[]
  minScore?: number
  maxScore?: number
}

interface CampaignData {
  userId?: string
  name: string
  channel: "sms" | "email"
  subject?: string
  message: string
  mediaUrls?: string[] | null
  buyerIds: string[]
  groupIds?: string[]
  sendToAllNumbers?: boolean
  filters?: CampaignFilters
}

export class CampaignService {
  static async createCampaign(data: CampaignData) {
    const { buyerIds = [], groupIds = [], filters, ...campaign } = data

    if (!campaign.userId) {
      throw new Error("CampaignService.createCampaign requires a userId")
    }

    const idSet = new Set<string>(buyerIds)
    if (groupIds.length) {
      const { data: groupRows, error: groupErr } = await supabase
        .from("buyer_groups")
        .select("buyer_id, buyers!inner(id)")
        .in("group_id", groupIds)
        .eq("buyers.sendfox_hidden", false)
      if (groupErr) {
        console.error("Error fetching group buyers:", groupErr)
        throw groupErr
      }
      for (const row of groupRows || []) {
        idSet.add(row.buyer_id)
      }
    }

    if (filters && Object.keys(filters).length) {
      let query = supabase
        .from("buyers")
        .select("id")
        .eq("sendfox_hidden", false)
      if (filters.tags && filters.tags.length) {
        query = query.overlaps("tags", filters.tags)
      }
      if (filters.locations && filters.locations.length) {
        query = query.overlaps("locations", filters.locations)
      }
      if (filters.minScore !== undefined) {
        query = query.gte("score", filters.minScore)
      }
      if (filters.maxScore !== undefined) {
        query = query.lte("score", filters.maxScore)
      }
      const { data: filtered, error: filterErr } = await query
      if (filterErr) {
        console.error("Error fetching filtered buyers:", filterErr)
        throw filterErr
      }
      for (const b of filtered || []) {
        idSet.add(b.id)
      }
    }
    let finalIds = Array.from(idSet)
    if (finalIds.length) {
      const { data: allowed } = await supabase
        .from("buyers")
        .select("id")
        .in("id", finalIds)
        .eq("sendfox_hidden", false)
      finalIds = (allowed || []).map((r) => r.id)
    }
    const { data: created, error } = await supabase
      .from("campaigns")
      .insert([
        {
          user_id: campaign.userId,
          name: campaign.name,
          channel: campaign.channel,
          subject: campaign.subject,
          message: campaign.message,
          media_url: campaign.mediaUrls && campaign.mediaUrls.length
            ? JSON.stringify(campaign.mediaUrls)
            : null,
          send_to_all_numbers: campaign.sendToAllNumbers ?? true,
          buyer_ids: buyerIds.length ? buyerIds : null,
          group_ids: groupIds.length ? groupIds : null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating campaign:", error)
      throw error
    }

    if (finalIds.length) {
      const rows = finalIds.map((id) => ({ campaign_id: created!.id, buyer_id: id }))
      const { error: recErr } = await supabase.from("campaign_recipients").insert(rows)
      if (recErr) {
        console.error("Error inserting recipients:", recErr)
        throw recErr
      }
    }

    return created
  }

  static async sendNow(campaignId: string) {
    const res = await fetch("/api/campaigns/send-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    })

    if (!res.ok) {
      let errorMsg = "Failed to send campaign"
      try {
        const data = await res.json()
        if (data?.error) errorMsg = data.error
      } catch {}
      throw new Error(errorMsg)
    }
  }

  static async schedule(
    campaignId: string,
    datetime: string,
    opts: {
      weekdayOnly?: boolean
      runFrom?: string | null
      runUntil?: string | null
    } = {},
  ) {
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        scheduled_at: datetime,
        weekday_only: opts.weekdayOnly ?? null,
        run_from: opts.runFrom ?? null,
        run_until: opts.runUntil ?? null,
      })
      .eq("id", campaignId)
      .select()
      .single()

    if (error) {
      console.error("Error scheduling campaign:", error)
      throw error
    }

    return data
  }

  static async listCampaigns(
    page = 1,
    filters: { channel?: string; status?: string } = {},
  ) {
    const PAGE_SIZE = 20
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from("campaigns")
      .select(
        "*, campaign_recipients(id,status,error,sent_at,provider_id,from_number,buyer_id,opened_at,bounced_at,unsubscribed_at,buyers(fname,lname,full_name))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })

    if (filters.channel) {
      query = query.eq("channel", filters.channel)
    }
    if (filters.status === "active") {
      query = query.in("status", ["pending", "processing"])
    } else if (filters.status === "completed") {
      query = query.in("status", ["sent", "error"])
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Error listing campaigns:", error)
      throw error
    }

    const campaignsWithCounts = (data || []).map((c: any) => {
      const recs = c.campaign_recipients || []
      const sentCount = recs.filter((r: any) => r.status === "sent").length
      const errorCount = recs.filter((r: any) => r.status === "error").length
      const openedCount = recs.filter((r: any) => r.opened_at).length
      const bouncedCount = recs.filter((r: any) => r.bounced_at).length
      const unsubCount = recs.filter((r: any) => r.unsubscribed_at).length
      return { ...c, sentCount, errorCount, openedCount, bouncedCount, unsubCount }
    })

    return { campaigns: campaignsWithCounts, totalCount: count || 0 }
  }
}

export default CampaignService
