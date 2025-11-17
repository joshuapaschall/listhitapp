import { X } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OffersDeclinedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Declined"
      value={value}
      icon={X}
      iconClass="text-red-600"
      tooltip="Offers declined by sellers."
    />
  )
}
