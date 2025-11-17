import { Users } from "lucide-react"
import KpiCard from "./KpiCard"

export default function BuyersAddedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Buyers Added"
      value={value}
      icon={Users}
      tooltip="Number of new buyers added in the selected period."
    />
  )
}
