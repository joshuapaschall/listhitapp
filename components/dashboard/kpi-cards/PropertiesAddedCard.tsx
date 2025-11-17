import { Home } from "lucide-react"
import KpiCard from "./KpiCard"

export default function PropertiesAddedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Properties Added"
      value={value}
      icon={Home}
      tooltip="New properties added to your inventory."
    />
  )
}
