import { Ban } from "lucide-react"
import KpiCard from "./KpiCard"

export default function UnsubscribeRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Unsubscribe Rate"
      value={`${value}%`}
      icon={Ban}
      iconClass="text-red-600"
      tooltip="Percentage of contacts that unsubscribed."
    />
  )
}
