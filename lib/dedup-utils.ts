import { parsePhoneNumberFromString } from "libphonenumber-js";

const DEFAULT_REGION = "US" as const;

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string | number | null): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_REGION);
  if (parsed?.nationalNumber) return String(parsed.nationalNumber);
  // Legacy fallback — never regress on pre-existing DB data
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits || null;
}

export function formatPhoneE164(phone?: string | number | null): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_REGION);
  if (parsed) return parsed.number;
  // Legacy fallback
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = "1" + digits;
  return "+" + digits;
}

export function isValidPhone(phone?: string | number | null): boolean {
  if (phone == null) return false;
  const parsed = parsePhoneNumberFromString(String(phone).trim(), DEFAULT_REGION);
  return parsed?.isValid() ?? false;
}

export function formatPhoneDisplay(phone?: string | number | null): string {
  if (phone == null) return "";
  const raw = String(phone).trim();
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_REGION);
  if (parsed) return parsed.formatNational();
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length === 10) return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  return raw;
}

export function mergeUnique<T>(a: T[] | null | undefined, b: T[] | null | undefined): T[] | null {
  const set = new Set<T>();
  (a || []).forEach((v) => set.add(v));
  (b || []).forEach((v) => set.add(v));
  return set.size ? Array.from(set) : null;
}
