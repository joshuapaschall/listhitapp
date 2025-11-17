import { CalendarCheck } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ShowingsCompletedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Completed"
      value={value}
      icon={CalendarCheck}
      iconClass="text-green-600"
      tooltip="Completed property showings."
    />
  )
}
