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
  scheduled_at?: string | null
  weekday_only?: boolean | null
  run_from?: string | null
  run_until?: string | null
  timezone?: string | null
  status?: string | null
}

export class CampaignService {
  static readonly DEFAULT_PAGE_SIZE = 10
  static async createCampaign(data: CampaignData) {
    const {
      buyerIds = [],
      groupIds = [],
      filters,
      userId,
      scheduled_at,
      weekday_only,
      run_from,
      run_until,
      timezone,
      status,
      ...campaign
    } = data

    let finalUserId = userId
    if (!finalUserId) {
      const { data: userResponse, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error("Error fetching authenticated user:", userError)
        throw userError
      }
      finalUserId = userResponse?.user?.id
    }

    if (!finalUserId) {
      throw new Error("Not signed in")
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
    const insertPayload: Record<string, any> = {
      user_id: finalUserId,
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
    }

    const resolvedTimezone =
      timezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : null) ??
      "America/New_York"
    insertPayload.timezone = resolvedTimezone

    if (scheduled_at !== undefined) {
      insertPayload.scheduled_at = scheduled_at ?? null
    }
    if (weekday_only !== undefined) {
      insertPayload.weekday_only = weekday_only ?? null
    }
    if (run_from !== undefined) {
      insertPayload.run_from = run_from ?? null
    }
    if (run_until !== undefined) {
      insertPayload.run_until = run_until ?? null
    }
    const finalStatus = status !== undefined ? status : scheduled_at ? "pending" : undefined
    if (finalStatus !== undefined) {
      insertPayload.status = finalStatus
    }
    const { data: created, error } = await supabase
      .from("campaigns")
      .insert([insertPayload])
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
      timezone?: string | null
    } = {},
  ) {
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        scheduled_at: datetime,
        weekday_only: opts.weekdayOnly ?? null,
        run_from: opts.runFrom ?? null,
        run_until: opts.runUntil ?? null,
        timezone:
          opts.timezone ??
          (typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null) ??
          "America/New_York",
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

  static async deleteCampaign(id: string) {
    const res = await fetch("/api/campaigns/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id }),
    })

    if (!res.ok) {
      let errorMsg = "Failed to delete campaign"
      try {
        const data = await res.json()
        if (data?.error) {
          errorMsg = data.error
        }
      } catch (err) {
        console.error("Failed to parse delete response", err)
      }
      throw new Error(errorMsg)
    }
  }

  static async listCampaigns(
    page = 1,
    filters: { channel?: string; status?: string } = {},
    pageSize: number = CampaignService.DEFAULT_PAGE_SIZE,
  ) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from("campaigns")
      .select(
        "*, campaign_recipients(id,status,error,sent_at,delivered_at,opened_at,clicked_at,bounced_at,complained_at,unsubscribed_at,provider_id,from_number,buyer_id,buyers(fname,lname,full_name))",
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
