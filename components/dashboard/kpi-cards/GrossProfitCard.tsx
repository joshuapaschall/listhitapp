import { DollarSign } from "lucide-react"
import KpiCard from "./KpiCard"

export default function GrossProfitCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Gross Profit"
      value={`$${value.toLocaleString()}`}
      icon={DollarSign}
      tooltip="Total gross profit for the period."
    />
  )
}
