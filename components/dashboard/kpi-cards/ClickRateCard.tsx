import { MousePointerClick } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ClickRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Click Rate"
      value={`${value}%`}
      icon={MousePointerClick}
      iconClass="text-green-600"
      tooltip="Percentage of opened emails that received clicks."
    />
  )
}
