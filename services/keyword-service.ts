import { supabase } from "@/lib/supabase"
import type { NegativeKeyword } from "@/lib/supabase"

export class KeywordService {
  static async listKeywords() {
    const { data, error } = await supabase
      .from("negative_keywords")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching keywords:", error)
      throw error
    }

    return (data || []) as NegativeKeyword[]
  }

  static async getKeyword(id: string) {
    const { data, error } = await supabase
      .from("negative_keywords")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching keyword:", error)
      throw error
    }

    return data as NegativeKeyword | null
  }

  static async addKeyword(keyword: Partial<NegativeKeyword>) {
    const { data, error } = await supabase
      .from("negative_keywords")
      .insert([keyword])
      .select()
      .single()

    if (error) {
      console.error("Error adding keyword:", error)
      throw error
    }

    return data as NegativeKeyword
  }

  static async updateKeyword(id: string, updates: Partial<NegativeKeyword>) {
    const { data, error } = await supabase
      .from("negative_keywords")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating keyword:", error)
      throw error
    }

    return data as NegativeKeyword
  }

  static async deleteKeyword(id: string) {
    const { error } = await supabase
      .from("negative_keywords")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting keyword:", error)
      throw error
    }
  }
}

