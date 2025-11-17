import type { Message } from "@/lib/supabase"
import Papa from "papaparse"

interface Row {
  created_at: string
  direction: string
  from_number: string | null
  to_number: string | null
  body: string | null
}

export function formatConversationAsCSV(messages: Message[]): string {
  const rows: Row[] = messages.map((m) => ({
    created_at: m.created_at,
    direction: m.direction,
    from_number: m.from_number,
    to_number: m.to_number,
    body: m.body,
  }))
  return Papa.unparse(rows)
}

export function formatConversationAsJSON(messages: Message[]): string {
  const rows: Row[] = messages.map((m) => ({
    created_at: m.created_at,
    direction: m.direction,
    from_number: m.from_number,
    to_number: m.to_number,
    body: m.body,
  }))
  return JSON.stringify(rows, null, 2)
}
