import { supabase } from "@/lib/supabase"

export interface Tag {
  id: string
  name: string
  color?: string
  is_protected?: boolean
}

export async function getTags(searchTerm?: string) {
  try {
    let query = supabase.from("tags").select("id, name, color, is_protected")

    if (searchTerm) {
      query = query.ilike("name", `%${searchTerm}%`)
    }

    const { data, error } = await query.order("name")

    if (error) throw error
    return data || []
  } catch (err) {
    console.error("Error fetching tags:", err)
    return []
  }
}

export async function createTag(name: string, color?: string) {
  try {
    const { data, error } = await supabase
      .from("tags")
      .insert([{ name: name.trim(), color: color || "#3B82F6" }])
      .select()

    if (error) throw error
    return data?.[0] as Tag
  } catch (err) {
    console.error("Error creating tag:", err)
    throw err
  }
}

export async function updateTagUsageCount(tagId: string, increment = true) {
  try {
    const { data: tag, error: fetchError } = await supabase.from("tags").select("usage_count").eq("id", tagId).single()

    if (fetchError) throw fetchError

    const currentCount = tag?.usage_count || 0
    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1)

    const { error: updateError } = await supabase.from("tags").update({ usage_count: newCount }).eq("id", tagId)

    if (updateError) throw updateError
  } catch (err) {
    console.error("Error updating tag usage count:", err)
  }
}
