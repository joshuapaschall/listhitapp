import { Calendar } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ShowingsScheduledCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Showings Scheduled"
      value={value}
      icon={Calendar}
      tooltip="Property showings scheduled."
    />
  )
}
