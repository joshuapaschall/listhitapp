import { Handshake } from "lucide-react"
import KpiCard from "./KpiCard"

export default function UnderContractCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Under Contract"
      value={value}
      icon={Handshake}
      iconClass="text-blue-600"
      tooltip="Properties with an accepted contract."
    />
  )
}
