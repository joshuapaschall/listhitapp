import { supabase } from "@/lib/supabase"
import type { TemplateRecord, TemplateType } from "@/lib/supabase"

const TEMPLATE_TABLES: Record<TemplateType, string> = {
  sms: "sms_templates",
  email: "email_templates",
  quick_reply: "quick_reply_templates",
}

export class TemplateService {
  static tableFor(type: TemplateType) {
    return TEMPLATE_TABLES[type]
  }

  static async listTemplates(type: TemplateType = "sms") {
    const { data, error } = await supabase
      .from(this.tableFor(type))
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching templates:", error)
      throw error
    }

    return (data || []) as TemplateRecord[]
  }

  static async getTemplate(id: string, type: TemplateType = "sms") {
    const { data, error } = await supabase
      .from(this.tableFor(type))
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching template:", error)
      throw error
    }

    return data as TemplateRecord | null
  }

  static async addTemplate(template: Partial<TemplateRecord>, type: TemplateType = "sms") {
    const { data, error } = await supabase
      .from(this.tableFor(type))
      .insert([template])
      .select()
      .single()

    if (error) {
      console.error("Error adding template:", error)
      throw error
    }

    return data as TemplateRecord
  }

  static async updateTemplate(
    id: string,
    updates: Partial<TemplateRecord>,
    type: TemplateType = "sms",
  ) {
    const { data, error } = await supabase
      .from(this.tableFor(type))
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating template:", error)
      throw error
    }

    return data as TemplateRecord
  }

  static async deleteTemplate(id: string, type: TemplateType = "sms") {
    const { error } = await supabase
      .from(this.tableFor(type))
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting template:", error)
      throw error
    }
  }
}
