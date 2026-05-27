import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mailbox, PhoneMissed, PhoneOff, TimerOff } from "lucide-react";

interface CallStatusBadgeProps {
  status?: string | null;
}

export default function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const value = (status ?? "unknown").toLowerCase();

  if (value === "completed") {
    return <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Completed</Badge>;
  }
  if (value === "voicemail") {
    return <Badge className="gap-1 border-purple-200 bg-purple-50 text-purple-700"><Mailbox className="h-3.5 w-3.5" />Voicemail</Badge>;
  }
  if (value === "missed") {
    return <Badge className="gap-1 border-red-200 bg-red-50 text-red-700"><PhoneMissed className="h-3.5 w-3.5" />Missed</Badge>;
  }
  if (value === "busy") {
    return <Badge className="gap-1 border-amber-200 bg-amber-50 text-amber-700"><TimerOff className="h-3.5 w-3.5" />Busy</Badge>;
  }
  if (value === "no_answer") {
    return <Badge className="gap-1 border-slate-200 bg-slate-100 text-slate-700"><PhoneOff className="h-3.5 w-3.5" />No answer</Badge>;
  }

  const label = value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return <Badge variant="secondary">{label}</Badge>;
}
