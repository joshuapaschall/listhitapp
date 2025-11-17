import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { toast } from "sonner"

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
  let listId: number | null = null
  try {
    const res = await fetch("/api/sendfox/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: group.name }),
    })
    if (!res.ok) {
      throw new Error(await res.text())
    }
    const data = await res.json()
    listId = Number(data.id)
  } catch (err) {
    log("error", "List creation failed", { error: err })
    toast.error("List sync failed")
  }
  try {
    const { data, error } = await supabase
      .from("groups")
      .insert([
        {
          ...group,
          sendfox_list_id: listId,
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

    if (group?.sendfox_list_id) {
      const { data: groupMembers, error: gmError } = await supabase
        .from("buyer_groups")
        .select("buyer_id")
        .eq("group_id", id)

      if (gmError) throw gmError

      const buyerIds = (groupMembers || []).map((bg) => bg.buyer_id)
      if (buyerIds.length) {
        const { data: buyers, error: bError } = await supabase
          .from("buyers")
          .select("email,fname,lname")
          .in("id", buyerIds)

        if (bError) throw bError

        for (const buyer of buyers || []) {
          if (buyer.email) {
            await fetch(`/api/sendfox/lists/${group.sendfox_list_id}/contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: buyer.email,
                first_name: buyer.fname || undefined,
                last_name: buyer.lname || undefined,
              }),
            })
          }
        }
      }
    }

    log("info", "Group updated", { id })
    return group
  } catch (err) {
    log("error", "Failed to update group", { error: err })
    throw err
  }
}

export async function deleteGroup(id: string, removeSendFoxList = false) {
  try {
    let listId: number | null = null
    const { data: groupData } = await supabase
      .from("groups")
      .select("sendfox_list_id")
      .eq("id", id)
      .single()

    listId = groupData?.sendfox_list_id ?? null

    // First remove all buyer-group relationships
    await supabase.from("buyer_groups").delete().eq("group_id", id)

    // Then delete the group
    const { error } = await supabase.from("groups").delete().eq("id", id)

    if (error) throw error

    if (removeSendFoxList && listId) {
      try {
        await fetch(`/api/sendfox/lists/${listId}`, {
          method: "DELETE",
        })
      } catch (sfErr) {
        log("error", "Failed to delete list", { error: sfErr })
      }
    }
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
    for (const buyerId of buyerIds) {
      await fetch("/api/sendfox/sync-buyer-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId }),
      })
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
    const { data: group } = await supabase
      .from("groups")
      .select("sendfox_list_id")
      .eq("id", groupId)
      .single()
    const { data: buyer } = await supabase
      .from("buyers")
      .select("email,sendfox_contact_id")
      .eq("id", buyerId)
      .single()
    if (group?.sendfox_list_id) {
      const contactId = buyer?.sendfox_contact_id
      if (contactId) {
        try {
          await fetch(`/api/sendfox/lists/${group.sendfox_list_id}/contacts/${contactId}`, {
            method: "DELETE",
          })
        } catch (err) {
          log("error", "Failed to remove contact from list", { error: err })
        }
      } else if (buyer?.email) {
        try {
          const res = await fetch(
            `/api/sendfox/lookup?email=${encodeURIComponent(buyer.email)}`,
          )
          const contact = await res.json()
          if (contact?.id) {
            await fetch(
              `/api/sendfox/lists/${group.sendfox_list_id}/contacts/${contact.id}`,
              { method: "DELETE" },
            )
          }
        } catch (err) {
          log("error", "Failed to remove contact from list", { error: err })
        }
      } else {
        log("warn", "Missing contact ID for buyer", { buyerId })
      }
    }
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
    const { data: group } = await supabase
      .from("groups")
      .select("sendfox_list_id")
      .eq("id", groupId)
      .single()
    if (group?.sendfox_list_id) {
      const { data: buyers } = await supabase
        .from("buyers")
        .select("id,email,sendfox_contact_id")
        .in("id", buyerIds)
      for (const buyer of buyers || []) {
        if (buyer.sendfox_contact_id) {
          try {
            await fetch(
              `/api/sendfox/lists/${group.sendfox_list_id}/contacts/${buyer.sendfox_contact_id}`,
              { method: "DELETE" },
            )
          } catch (err) {
            log("error", "Failed to remove contact from list", { error: err })
          }
        } else if (buyer.email) {
          try {
            const res = await fetch(
              `/api/sendfox/lookup?email=${encodeURIComponent(buyer.email)}`,
            )
            const contact = await res.json()
            if (contact?.id) {
              await fetch(
              `/api/sendfox/lists/${group.sendfox_list_id}/contacts/${contact.id}`,
                { method: "DELETE" },
              )
            }
          } catch (err) {
            log("error", "Failed to remove contact from list", { error: err })
          }
        } else {
          log("warn", "Missing contact ID for buyer", { buyerId: buyer.id })
        }
      }
    }
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
