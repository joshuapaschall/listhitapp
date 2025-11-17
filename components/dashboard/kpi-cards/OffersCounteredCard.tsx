import { Repeat2 } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OffersCounteredCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Countered"
      value={value}
      icon={Repeat2}
      tooltip="Offers that received counters."
    />
  )
}
