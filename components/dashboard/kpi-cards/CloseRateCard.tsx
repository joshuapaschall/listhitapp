import { Percent } from "lucide-react"
import KpiCard from "./KpiCard"

export default function CloseRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Close Rate"
      value={`${value}%`}
      icon={Percent}
      tooltip="Percentage of offers that closed."
    />
  )
}
