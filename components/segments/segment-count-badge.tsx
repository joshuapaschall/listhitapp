"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Users } from "lucide-react"
import { isConditionComplete } from "@/lib/segments/condition-utils"
import type { SegmentDefinition } from "@/lib/segments/types"

interface SegmentCountBadgeProps {
  definition: SegmentDefinition
  channel: "email" | "sms" | "both"
  contextCampaignId?: string
}

// Drop incomplete conditions before previewing — they'd be invalid to resolve.
function completeDefinition(def: SegmentDefinition): SegmentDefinition {
  return { match: def.match, conditions: def.conditions.filter(isConditionComplete) }
}

async function fetchCount(
  definition: SegmentDefinition,
  channel: "email" | "sms",
  contextCampaignId?: string,
): Promise<number> {
  const res = await fetch("/api/segments/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ definition, channel, contextCampaignId }),
  })
  if (!res.ok) throw new Error(`Preview failed (${res.status})`)
  const json = await res.json()
  return typeof json?.count === "number" ? json.count : 0
}

export default function SegmentCountBadge({ definition, channel, contextCampaignId }: SegmentCountBadgeProps) {
  const [loading, setLoading] = useState(false)
  // Retain the last good values on error.
  const [email, setEmail] = useState<number | null>(null)
  const [sms, setSms] = useState<number | null>(null)
  const reqId = useRef(0)

  const def = completeDefinition(definition)
  // Stable dependency key so we only refetch on real changes.
  const key = JSON.stringify({ def, channel, contextCampaignId })

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        if (channel === "both") {
          const [e, s] = await Promise.all([
            fetchCount(def, "email", contextCampaignId),
            fetchCount(def, "sms", contextCampaignId),
          ])
          if (reqId.current === id) {
            setEmail(e)
            setSms(s)
          }
        } else {
          const c = await fetchCount(def, channel, contextCampaignId)
          if (reqId.current === id) {
            if (channel === "email") setEmail(c)
            else setSms(c)
          }
        }
      } catch {
        // Keep the last good count on error.
      } finally {
        if (reqId.current === id) setLoading(false)
      }
    }, 400)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const isEmpty = def.conditions.length === 0
  const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString())

  let body: React.ReactNode
  if (isEmpty) {
    body = "Everyone reachable"
    if (channel === "both") {
      body = `Everyone reachable · ${fmt(email)} email · ${fmt(sms)} SMS`
    } else {
      body = `Everyone reachable · ${fmt(channel === "email" ? email : sms)}`
    }
  } else if (channel === "both") {
    body = `${fmt(email)} email-reachable · ${fmt(sms)} SMS-reachable`
  } else {
    const n = channel === "email" ? email : sms
    body = `${fmt(n)} ${channel === "email" ? "email-reachable" : "SMS-reachable"}`
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
      <span className="tabular-nums">{body}</span>
    </div>
  )
}
