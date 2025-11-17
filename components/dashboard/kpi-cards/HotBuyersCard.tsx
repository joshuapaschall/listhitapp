import { Flame } from "lucide-react"
import KpiCard from "./KpiCard"

export default function HotBuyersCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Hot Buyers"
      value={value}
      icon={Flame}
      tooltip="Buyers marked as hot leads."
    />
  )
}
