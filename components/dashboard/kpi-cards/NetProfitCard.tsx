import { Coins } from "lucide-react"
import KpiCard from "./KpiCard"

export default function NetProfitCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Net Profit"
      value={`$${value.toLocaleString()}`}
      icon={Coins}
      iconClass="text-green-600"
      tooltip="Net profit after expenses."
    />
  )
}
