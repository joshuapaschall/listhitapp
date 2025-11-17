import { MessageSquare } from "lucide-react"
import KpiCard from "./KpiCard"

export default function TextsReceivedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Texts Received"
      value={value}
      icon={MessageSquare}
      iconClass="text-blue-600"
      tooltip="Incoming text messages received."
    />
  )
}
