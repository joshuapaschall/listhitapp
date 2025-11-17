import { XCircle } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ShowingsCancelledCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Cancelled"
      value={value}
      icon={XCircle}
      iconClass="text-red-600"
      tooltip="Showings that were cancelled."
    />
  )
}
