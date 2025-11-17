import { BadgeDollarSign } from "lucide-react"
import KpiCard from "./KpiCard"

export default function SoldPropertiesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Sold"
      value={value}
      icon={BadgeDollarSign}
      iconClass="text-green-600"
      tooltip="Properties sold and closed."
    />
  )
}
