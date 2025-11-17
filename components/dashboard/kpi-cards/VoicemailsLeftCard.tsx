import { Voicemail } from "lucide-react"
import KpiCard from "./KpiCard"

export default function VoicemailsLeftCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Voicemails Left"
      value={value}
      icon={Voicemail}
      iconClass="text-blue-600"
      tooltip="Number of voicemails left for contacts."
    />
  )
}
