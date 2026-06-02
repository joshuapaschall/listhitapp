import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import type { SegmentDefinition, SegmentMatch } from "@/lib/segments/types"

const log = createLogger("segment")

export const EMPTY_DEFINITION: SegmentDefinition = { match: "all", conditions: [] }

export interface Segment {
  id: string
  org_id: string
  name: string
  description: string | null
  // null = usable for both email and sms
  channel: "email" | "sms" | null
  match: SegmentMatch
  definition: SegmentDefinition
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SegmentInput {
  name: string
  description?: string | null
  channel?: "email" | "sms" | null
  definition: SegmentDefinition
}

export interface SegmentPatch {
  name?: string
  description?: string | null
  channel?: "email" | "sms" | null
  definition?: SegmentDefinition
}

// Keep the `match` column mirrored to definition.match so it can be queried
// without parsing the jsonb.
function withMirroredMatch<T extends { definition?: SegmentDefinition }>(input: T) {
  if (!input.definition) return input
  return { ...input, match: input.definition.match }
}

export class SegmentService {
  static async listSegments(): Promise<Segment[]> {
    const { data, error } = await supabase
      .from("segments")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })

    if (error) {
      log.error("listSegments failed", error)
      throw error
    }
    return (data ?? []) as Segment[]
  }

  static async getSegment(id: string): Promise<Segment | null> {
    const { data, error } = await supabase
      .from("segments")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      log.error("getSegment failed", error)
      throw error
    }
    return (data as Segment) ?? null
  }

  static async createSegment(input: SegmentInput): Promise<Segment> {
    const definition = input.definition ?? EMPTY_DEFINITION
    const payload = withMirroredMatch({
      name: input.name,
      description: input.description ?? null,
      channel: input.channel ?? null,
      definition,
    })

    const { data, error } = await supabase
      .from("segments")
      .insert(payload)
      .select("*")
      .single()

    if (error) {
      log.error("createSegment failed", error)
      throw error
    }
    return data as Segment
  }

  static async updateSegment(id: string, patch: SegmentPatch): Promise<Segment> {
    const payload: Record<string, any> = withMirroredMatch({ ...patch })
    payload.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("segments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      log.error("updateSegment failed", error)
      throw error
    }
    return data as Segment
  }

  // Soft delete only — historical campaigns may reference the segment via
  // campaigns.segment_id, so the row must never be hard-deleted.
  static async softDeleteSegment(id: string): Promise<void> {
    const { error } = await supabase
      .from("segments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      log.error("softDeleteSegment failed", error)
      throw error
    }
  }

  static async duplicateSegment(id: string): Promise<Segment> {
    const source = await this.getSegment(id)
    if (!source) throw new Error("Segment not found")
    return this.createSegment({
      name: `${source.name} (copy)`,
      description: source.description,
      channel: source.channel,
      definition: source.definition ?? EMPTY_DEFINITION,
    })
  }
}
