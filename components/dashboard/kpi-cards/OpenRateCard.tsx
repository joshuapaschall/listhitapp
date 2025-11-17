import { MailOpen } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OpenRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Open Rate"
      value={`${value}%`}
      icon={MailOpen}
      iconClass="text-green-600"
      tooltip="Percentage of sent emails that were opened."
    />
  )
}
