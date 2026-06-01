import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

interface FilterState {
  search?: string
  selectedTags?: string[]
  excludeTags?: string[]
  selectedLocations?: string[]
  minScore?: string
  maxScore?: string
  vip?: string
  vetted?: string
  canReceiveEmail?: string
  canReceiveSMS?: string
  createdAfter?: string
  createdBefore?: string
  propertyType?: string
}

type ExportBody = {
  filters?: FilterState
  quickFilters?: string[]
  groupId?: string
  buyerIds?: string[]
}

function applyBuyerFilters(query: any, filters: FilterState, quickFilters: string[]) {
  if (filters.search) {
    const encoded = encodeURIComponent(filters.search)
    query = query.or(
      `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
    )
  }

  if (filters.vip === "vip") {
    query = query.eq("vip", true)
  } else if (filters.vip === "not-vip") {
    query = query.eq("vip", false)
  }

  if (filters.vetted === "vetted") {
    query = query.eq("vetted", true)
  } else if (filters.vetted === "not-vetted") {
    query = query.eq("vetted", false)
  }

  if (filters.minScore) {
    query = query.gte("score", Number.parseInt(filters.minScore))
  }

  if (filters.maxScore) {
    query = query.lte("score", Number.parseInt(filters.maxScore))
  }

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter)
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore)
  }

  if (filters.selectedTags && filters.selectedTags.length > 0) {
    query = query.contains("tags", filters.selectedTags)
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const exclude = `{${filters.excludeTags
      .map((tag) => `"${tag}"`)
      .join(",")}}`
    query = query.not("tags", "ov", exclude)
  }

  if (filters.selectedLocations && filters.selectedLocations.length > 0) {
    query = query.overlaps("locations", filters.selectedLocations)
  }

  if (filters.propertyType && filters.propertyType !== "any") {
    query = query.overlaps("property_type", [filters.propertyType])
  }

  if (filters.canReceiveEmail === "yes") {
    query = query.eq("can_receive_email", true)
  } else if (filters.canReceiveEmail === "no") {
    query = query.eq("can_receive_email", false)
  }

  if (filters.canReceiveSMS === "yes") {
    query = query.eq("can_receive_sms", true)
  } else if (filters.canReceiveSMS === "no") {
    query = query.eq("can_receive_sms", false)
  }

  if (quickFilters.includes("vip")) {
    query = query.eq("vip", true)
  }

  if (quickFilters.includes("hot")) {
    query = query.gte("score", 85)
  }

  if (quickFilters.includes("new")) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte("created_at", sevenDaysAgo.toISOString())
  }

  if (quickFilters.includes("highScore")) {
    query = query.gte("score", 90)
  }

  return query
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "buyers.export")
  if (denied) return denied

  try {
    const body = (await request.json()) as ExportBody
    const filters = body.filters ?? {}
    const quickFilters = Array.isArray(body.quickFilters) ? body.quickFilters : []
    const groupId = body.groupId || undefined
    const buyerIds = Array.isArray(body.buyerIds) ? body.buyerIds : undefined

    let query: any = supabase.from("buyers")

    if (groupId) {
      query = query
        .select("*, buyer_groups!inner(group_id)")
        .eq("buyer_groups.group_id", groupId)
    } else {
      query = query.select("*")
    }

    query = query.is("deleted_at", null)
    query = applyBuyerFilters(query, filters, quickFilters)

    if (buyerIds && buyerIds.length > 0) {
      query = query.in("id", buyerIds)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to export buyers" }, { status: 500 })
    }

    const buyers = (data || []).map((row: any) => {
      const { buyer_groups, ...buyer } = row
      return buyer
    })

    return NextResponse.json({ buyers })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "error" }, { status: 500 })
  }
}
