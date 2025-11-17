import { DollarSign } from "lucide-react"
import KpiCard from "./KpiCard"

export default function AvgAssignmentFeeCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Avg Assignment Fee"
      value={`$${value.toLocaleString()}`}
      icon={DollarSign}
      tooltip="Average assignment fee per deal."
    />
  )
}
