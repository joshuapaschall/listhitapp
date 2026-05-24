import { Badge } from "@/components/ui/badge";

interface CallStatusBadgeProps {
  status?: string | null;
}

const BRAND_CLASS = "border-[color:var(--brand)] bg-[color:var(--brand-tint)] text-[color:var(--brand)]";

export default function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const value = (status ?? "unknown").toLowerCase();
  const label = value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  let className = "border-border bg-muted text-muted-foreground";
  if (["completed", "answered", "bridged"].includes(value)) className = BRAND_CLASS;
  else if (["missed", "failed"].includes(value)) className = "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
  else if (value === "voicemail") className = "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300";
  else if (["initiated", "ringing"].includes(value)) className = "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";

  return <Badge className={className}>{label}</Badge>;
}
