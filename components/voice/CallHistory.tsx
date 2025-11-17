"use client"
import { useEffect, useState } from "react"
import { supabase, type Buyer } from "@/lib/supabase"

interface CallRecord {
  id: string
  buyer_id: string | null
  direction: string
  from_number: string | null
  to_number: string | null
  started_at: string | null
  ended_at: string | null
  duration: number | null
  recording_url: string | null
  buyers?: Buyer
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([])

  useEffect(() => {
    supabase
      .from("calls")
      .select("*, buyers!left(id,fname,lname,full_name)")
      .order("started_at", { ascending: false })
      .then(({ data }) => setCalls(data || []))
  }, [])

  return (
    <div className="space-y-2">
      {calls.map(c => (
        <div key={c.id} className="p-2 border rounded">
          <div className="flex justify-between">
            <div>{c.direction} {c.from_number} ➜ {c.to_number}</div>
            <div>{c.duration ? `${c.duration}s` : ""}</div>
          </div>
          {c.recording_url && (
            <audio controls className="mt-2" src={c.recording_url} />
          )}
        </div>
      ))}
    </div>
  )
}
