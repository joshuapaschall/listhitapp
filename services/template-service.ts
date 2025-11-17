import { supabase } from "@/lib/supabase"
import type { MessageTemplate } from "@/lib/supabase"

export class TemplateService {
  static async listTemplates() {
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching templates:", error)
      throw error
    }

    return (data || []) as MessageTemplate[]
  }

  static async getTemplate(id: string) {
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching template:", error)
      throw error
    }

    return data as MessageTemplate | null
  }

  static async addTemplate(template: Partial<MessageTemplate>) {
    const { data, error } = await supabase
      .from("message_templates")
      .insert([template])
      .select()
      .single()

    if (error) {
      console.error("Error adding template:", error)
      throw error
    }

    return data as MessageTemplate
  }

  static async updateTemplate(id: string, updates: Partial<MessageTemplate>) {
    const { data, error } = await supabase
      .from("message_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating template:", error)
      throw error
    }

    return data as MessageTemplate
  }

  static async deleteTemplate(id: string) {
    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting template:", error)
      throw error
    }
  }
}
