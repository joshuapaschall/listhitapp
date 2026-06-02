"use client"

import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import TagSelector from "@/components/buyers/tag-selector"
import LocationSelector from "@/components/buyers/location-selector"
import { OptionsCombobox, OptionsMultiCombobox } from "./options-combobox"
import type { AttributeFieldSpec } from "@/lib/segments/catalog"
import type { AttributeCondition, AttributeOperator } from "@/lib/segments/types"

type Value = AttributeCondition["value"]

interface ValueInputProps {
  spec: AttributeFieldSpec
  operator: AttributeOperator
  value: Value
  onChange: (value: Value) => void
}

const VALUELESS: AttributeOperator[] = ["is_blank", "is_not_blank"]

function toNum(raw: string): number | undefined {
  if (raw.trim() === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function toDate(iso: unknown): Date | undefined {
  if (typeof iso !== "string" || !iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export default function ValueInput({ spec, operator, value, onChange }: ValueInputProps) {
  // Blank / not-blank and booleans need no value control.
  if (VALUELESS.includes(operator) || spec.valueType === "boolean") return null

  if (spec.valueType === "text[]") {
    const arr = Array.isArray(value) ? (value as string[]) : []
    if (spec.field === "tags") {
      return <TagSelector value={arr} onChange={(v) => onChange(v)} allowCreate={false} />
    }
    if (spec.field === "locations") {
      return <LocationSelector value={arr} onChange={(v) => onChange(v)} />
    }
    return <OptionsMultiCombobox field="property_type" value={arr} onChange={(v) => onChange(v)} placeholder="Select property types…" />
  }

  if (spec.valueType === "text") {
    if (spec.field === "status" || spec.field === "source") {
      return (
        <OptionsCombobox
          field={spec.field}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          placeholder={`Select ${spec.label.toLowerCase()}…`}
        />
      )
    }
    return (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={spec.label}
      />
    )
  }

  if (spec.valueType === "number") {
    if (operator === "between") {
      const range = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as {
        min?: number
        max?: number
      }
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={range.min ?? ""}
            onChange={(e) => onChange({ ...range, min: toNum(e.target.value) })}
            placeholder="Min"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            value={range.max ?? ""}
            onChange={(e) => onChange({ ...range, max: toNum(e.target.value) })}
            placeholder="Max"
          />
        </div>
      )
    }
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(toNum(e.target.value))}
        placeholder="Value"
      />
    )
  }

  // date
  if (operator === "within_days") {
    const days = ((value && typeof value === "object" ? value : {}) as { days?: number }).days
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Last</span>
        <Input
          type="number"
          min={1}
          className="w-24"
          value={days ?? ""}
          onChange={(e) => onChange({ days: toNum(e.target.value) })}
          placeholder="30"
        />
        <span className="text-sm text-muted-foreground">days</span>
      </div>
    )
  }
  if (operator === "between") {
    const range = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as {
      min?: string
      max?: string
    }
    // Date ranges are stored as ISO strings; the resolver accepts string bounds.
    // The Phase 1 value union types min/max as numbers, so cast at the boundary.
    return (
      <div className="flex items-center gap-2">
        <DatePicker
          date={toDate(range.min)}
          setDate={(d) => onChange({ ...range, min: d?.toISOString() } as unknown as Value)}
          placeholder="From"
        />
        <span className="text-muted-foreground">–</span>
        <DatePicker
          date={toDate(range.max)}
          setDate={(d) => onChange({ ...range, max: d?.toISOString() } as unknown as Value)}
          placeholder="To"
        />
      </div>
    )
  }
  // before / after
  return (
    <DatePicker
      date={toDate(value)}
      setDate={(d) => onChange(d ? d.toISOString() : undefined)}
      placeholder="Pick a date"
    />
  )
}
