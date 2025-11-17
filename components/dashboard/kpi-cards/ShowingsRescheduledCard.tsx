import { RefreshCcw } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ShowingsRescheduledCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Rescheduled"
      value={value}
      icon={RefreshCcw}
      tooltip="Showings that were rescheduled."
    />
  )
}
