export type CallDirection = "inbound" | "outbound";

export interface CallParty {
  fname?: string | null;
  lname?: string | null;
}

export interface CallAgent {
  display_name?: string | null;
}

export interface CallLike {
  direction?: CallDirection | null;
  from_number?: string | null;
  to_number?: string | null;
  started_at?: string | null;
  buyer?: CallParty | null;
  user?: CallAgent | null;
}

export function formatPhone(e164OrRaw?: string | null): string {
  if (!e164OrRaw) return "—";
  const digits = e164OrRaw.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalized.length === 10) {
    return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  return e164OrRaw;
}

export function formatDuration(seconds?: number | null): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function relativeCallTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("en-US", {
    month: isToday ? undefined : "short",
    day: isToday ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function externalNumber(call: CallLike): string {
  if (call.direction === "inbound") return call.from_number ?? "";
  return call.to_number ?? "";
}

export function contactName(call: CallLike): string {
  const fullName = `${call.buyer?.fname ?? ""} ${call.buyer?.lname ?? ""}`.trim();
  return fullName || "Unknown caller";
}

export function handledBy(call: CallLike): string {
  return call.user?.display_name ?? "—";
}
