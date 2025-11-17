import { CheckCircle } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OffersAcceptedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Accepted"
      value={value}
      icon={CheckCircle}
      iconClass="text-green-600"
      tooltip="Offers accepted by sellers."
    />
  )
}
