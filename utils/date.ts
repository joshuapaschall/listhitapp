import { isToday, isYesterday } from "date-fns"

export function formatSmartTimestamp(date: Date | string | null, now: Date = new Date()): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ""
  if (isToday(d)) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  if (isYesterday(d)) return "Yesterday"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
