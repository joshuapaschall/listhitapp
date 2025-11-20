import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function insertText(
  value: string,
  insert: string,
  start: number,
  end: number,
): { value: string; position: number } {
  const newValue = value.slice(0, start) + insert + value.slice(end)
  return { value: newValue, position: start + insert.length }
}

export function renderTemplate(
  message: string,
  buyer: {
    fname?: string | null;
    lname?: string | null;
    phone?: string | null;
    email?: string | null;
    contact_form_link?: string | null;
  } = {},
  context: { myFirstName?: string | null; myLastName?: string | null } = {},
): string {
  return message
    .replace(/{{first_name}}/g, buyer.fname || "")
    .replace(/{{last_name}}/g, buyer.lname || "")
    .replace(/{{phone}}/g, buyer.phone || "")
    .replace(/{{email}}/g, buyer.email || "")
    .replace(/{{contact_form_link}}/g, buyer.contact_form_link || "")
    .replace(/{{my_first_name}}/g, context.myFirstName || "")
    .replace(/{{my_last_name}}/g, context.myLastName || "");
}
