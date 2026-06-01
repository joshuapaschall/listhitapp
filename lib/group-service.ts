import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("group")

export interface Group {
  id: string
  name: string
  description?: string
  type?: string
  criteria?: any
  color?: string
  sendfox_list_id?: number | null
  created_at: string
  updated_at?: string
}

export async function getGroups() {
  try {
    const { data, error } = await supabase.from("groups").select("*").order("name")

    if (error) throw error
    return data || []
  } catch (err) {
    log("error", "Failed to fetch groups", { error: err })
    return []
  }
}

export async function createGroup(
  group: Omit<Group, "id" | "created_at" | "updated_at" | "sendfox_list_id">
) {
  try {
    const { data, error } = await supabase
      .from("groups")
      .insert([
        {
          ...group,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      log("error", "Group insert failed", { error })
      throw new Error(error.message || "Failed to create group")
    }
    const created = data?.[0] as Group
    log("info", "Group created", { id: created?.id })
    return created
  } catch (err) {
    log("error", "Failed to create group", { error: err })
    throw err
  }
}

export async function updateGroup(id: string, updates: Partial<Group>) {
  try {
    const { data, error } = await supabase
      .from("groups")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()

    if (error) throw error
    const group = data?.[0] as Group

    log("info", "Group updated", { id })
    return group
  } catch (err) {
    log("error", "Failed to update group", { error: err })
    throw err
  }
}

export async function deleteGroup(id: string) {
  try {
    // First remove all buyer-group relationships
    await supabase.from("buyer_groups").delete().eq("group_id", id)

    // Then delete the group
    const { error } = await supabase.from("groups").delete().eq("id", id)

    if (error) throw error
  } catch (err) {
    log("error", "Failed to delete group", { error: err })
    throw err
  }
}

export async function getBuyerGroups(buyerId: string) {
  try {
    const { data, error } = await supabase.from("buyer_groups").select("group_id").eq("buyer_id", buyerId)

    if (error) throw error
    return (data || []).map((item) => item.group_id)
  } catch (err) {
    log("error", "Failed to fetch buyer groups", { error: err })
    return []
  }
}

export async function addBuyersToGroups(buyerIds: string[], groupIds: string[]) {
  try {
    const { data: existing } = await supabase
      .from("buyer_groups")
      .select("buyer_id,group_id")
      .in("buyer_id", buyerIds)
      .in("group_id", groupIds)

    const existingSet = new Set(
      (existing || []).map((r: any) => `${r.buyer_id}:${r.group_id}`),
    )
    const entries: { buyer_id: string; group_id: string }[] = []
    for (const b of buyerIds) {
      for (const g of groupIds) {
        const key = `${b}:${g}`
        if (!existingSet.has(key)) entries.push({ buyer_id: b, group_id: g })
      }
    }
    if (entries.length) {
      const { error } = await supabase.from("buyer_groups").insert(entries)
      if (error) throw error
    }
  } catch (err) {
    log("error", "Failed to add buyers to groups", { error: err })
    throw err
  }
}

export async function replaceGroupsForBuyers(
  buyerIds: string[],
  targetGroupIds: string[],
  keepDefault = false,
): Promise<{ changedRows: number }> {
  try {
    const res = await fetch("/api/groups/replace-for-buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerIds, targetGroupIds, keepDefault }),
    })
    if (!res.ok) {
      throw new Error("Failed to replace buyer groups")
    }
    const rpcResult = await res.json()
    const normalizeCount = (v: unknown) =>
      typeof v === "bigint" ? Number(v) : ((v as number) ?? 0)
    const changedRows = normalizeCount((rpcResult as any)?.changedRows)
    return { changedRows }
  } catch (err) {
    log("error", "Failed to replace buyer groups", { error: err })
    throw err
  }
}

export async function clearAllGroupsForBuyers(
  buyerIds: string[],
  keepDefault = false,
) : Promise<{ changedRows: number }> {
  const res = await fetch("/api/groups/replace-for-buyers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buyerIds, targetGroupIds: [], keepDefault }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || "Failed to remove from all groups")
  }
  const rpcResult = await res.json().catch(() => ({}))
  const normalizeCount = (v: unknown) =>
    typeof v === "bigint" ? Number(v) : ((v as number) ?? 0)
  const changedRows = normalizeCount((rpcResult as any)?.changedRows)
  return { changedRows }
}

export async function removeBuyerFromGroup(buyerId: string, groupId: string) {
  try {
    const { error } = await supabase
      .from("buyer_groups")
      .delete()
      .eq("buyer_id", buyerId)
      .eq("group_id", groupId)
    if (error) throw error
  } catch (err) {
    log("error", "Failed to remove buyer from group", { error: err })
    throw err
  }
}

export async function removeBuyersFromGroup(buyerIds: string[], groupId: string) {
  try {
    const { error } = await supabase
      .from("buyer_groups")
      .delete()
      .in("buyer_id", buyerIds)
      .eq("group_id", groupId)
    if (error) throw error
  } catch (err) {
    log("error", "Failed to remove buyers from group", { error: err })
    throw err
  }
}

export async function removeBuyersFromGroups(buyerIds: string[], groupIds: string[]) {
  try {
    for (const groupId of groupIds) {
      await removeBuyersFromGroup(buyerIds, groupId)
    }
  } catch (err) {
    log("error", "Failed to remove buyers from groups", { error: err })
    throw err
  }
}
