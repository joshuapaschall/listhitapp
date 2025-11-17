import { supabase } from "@/lib/supabase"
import type { AIPrompt } from "@/lib/supabase"

export class PromptService {
  static async listPrompts() {
    const { data, error } = await supabase
      .from("ai_prompts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching prompts:", error)
      throw error
    }

    return (data || []) as AIPrompt[]
  }

  static async getPrompt(id: string) {
    const { data, error } = await supabase
      .from("ai_prompts")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching prompt:", error)
      throw error
    }

    return data as AIPrompt | null
  }

  static async addPrompt(prompt: Partial<AIPrompt>) {
    const { data, error } = await supabase
      .from("ai_prompts")
      .insert([prompt])
      .select()
      .single()

    if (error) {
      console.error("Error adding prompt:", error)
      throw error
    }

    return data as AIPrompt
  }

  static async updatePrompt(id: string, updates: Partial<AIPrompt>) {
    const { data, error } = await supabase
      .from("ai_prompts")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating prompt:", error)
      throw error
    }

    return data as AIPrompt
  }

  static async deletePrompt(id: string) {
    const { error } = await supabase
      .from("ai_prompts")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting prompt:", error)
      throw error
    }
  }
}
