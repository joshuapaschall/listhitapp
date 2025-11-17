import { Home } from "lucide-react"
import KpiCard from "./KpiCard"

export default function TotalPropertiesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Total Properties"
      value={value}
      icon={Home}
      tooltip="All properties in your inventory."
    />
  )
}
