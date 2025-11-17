import { Building2 } from "lucide-react"
import KpiCard from "./KpiCard"

export default function ActivePropertiesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Active"
      value={value}
      icon={Building2}
      iconClass="text-green-600"
      tooltip="Properties currently active on the market."
    />
  )
}
