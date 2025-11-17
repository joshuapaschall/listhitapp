import { TrendingDown } from "lucide-react"
import KpiCard from "./KpiCard"

export default function BounceRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Bounce Rate"
      value={`${value}%`}
      icon={TrendingDown}
      iconClass="text-red-600"
      tooltip="Percentage of emails that bounced."
    />
  )
}
