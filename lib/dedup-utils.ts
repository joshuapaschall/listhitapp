export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string | number | null): string | null {
  if (phone == null) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits || null;
}

export function formatPhoneE164(phone?: string | number | null): string | null {
  if (phone == null) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = "1" + digits;
  return "+" + digits;
}

export function mergeUnique<T>(a: T[] | null | undefined, b: T[] | null | undefined): T[] | null {
  const set = new Set<T>();
  (a || []).forEach((v) => set.add(v));
  (b || []).forEach((v) => set.add(v));
  return set.size ? Array.from(set) : null;
}
