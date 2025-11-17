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
  buyer: { fname?: string | null; lname?: string | null },
): string {
  return message
    .replace(/{{first_name}}/g, buyer.fname || "")
    .replace(/{{last_name}}/g, buyer.lname || "")
}
