import { CalendarCheck } from "lucide-react"
import KpiCard from "./KpiCard"

export default function FollowUpsCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Follow-ups Due"
      value={value}
      icon={CalendarCheck}
      tooltip="Outstanding follow-up reminders."
    />
  )
}
