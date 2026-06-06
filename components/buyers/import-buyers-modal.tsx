"use client"

// CSV importer with support for mapping templates, manual tags, locations,
// property types and group assignment. After inserting buyers the IDs are
// added to the selected groups.

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileUp, AlertCircle, Check, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("import-buyers-modal")

import { normalizeEmail, normalizePhone, mergeUnique, hasContactInfo } from "@/lib/dedup-utils"
import TagSelector from "./tag-selector"
import { PROPERTY_TYPES } from "@/lib/constant"
import LocationSelector from "./location-selector"
import GroupTreeSelector from "./group-tree-selector"
import { addBuyersToGroups } from "@/lib/group-service"
import { Can } from "@/components/auth/Can"

// Field mapping definitions
const FIELD_MAPPINGS = [
  { db: "fname", label: "First Name" },
  { db: "lname", label: "Last Name" },
  { db: "email", label: "Email" },
  { db: "phone", label: "Phone 1" },
  { db: "phone2", label: "Phone 2" },
  { db: "phone3", label: "Phone 3" },
  { db: "company", label: "Company" },
  { db: "notes", label: "Notes" },
  { db: "mailing_address", label: "Mailing Address" },
  { db: "mailing_city", label: "Mailing City" },
  { db: "mailing_state", label: "Mailing State" },
  { db: "mailing_zip", label: "Mailing Zip" },
  { db: "locations", label: "Geotag/Locations", type: "array" },
  { db: "tags", label: "Tags", type: "array" },
  { db: "property_type", label: "Property Types", type: "array" },
  { db: "source", label: "Source" },
  { db: "status", label: "Status" },
]

// Wizard phases shown in the stepper header. Index maps 1:1 to the `step` state.
const PHASES = ["Upload", "Map fields", "Organize", "Done"] as const


// Helper functions for parsing data
function parseBoolean(val: any): boolean {
  if (typeof val === "boolean") return val
  if (typeof val !== "string") return false
  const v = val.trim().toLowerCase()
  return ["yes", "true", "1", "y", "t", "on"].includes(v)
}

function parseArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)

  return String(val)
    .split(/[,;|]/)
    .map((v: string) => v.trim())
    .filter(Boolean)
}

function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null
  const num = Number(val)
  return isNaN(num) ? null : num
}

export async function importBuyersFromCsv(
  csvRows: any[],
  mapping: Record<string, string>,
  extraTags: string[],
  extraLocations: string[],
  extraPropertyTypes: string[],
  groupIds: string[],
  onProgress?: (pct: number) => void,
): Promise<{ inserted: number; updated: number; skipped: number }> {
  log("import", "Starting import with mapping:", mapping)

  const { data: existingTags, error: tagFetchError } = await supabase
    .from("tags")
    .select("name")

  if (tagFetchError) {
    throw tagFetchError
  }

  const tagMap: Record<string, string> = {}
  existingTags?.forEach((t: { name: string }) => {
    if (t.name) tagMap[t.name.toLowerCase()] = t.name
  })

  const buyersToInsert = csvRows.map((row: any, index: number) => {
    const obj: Record<string, any> = {}

    log("import", `Processing row ${index}:`, row)

    FIELD_MAPPINGS.forEach(({ db, type }) => {
      const csvField = mapping[db]
      if (!csvField || csvField === "none") return

      let value = row[csvField]

      log("import", `Mapping ${db} from ${csvField}: "${value}" (type: ${type})`)

      if (type === "bool") {
        value = parseBoolean(value)
      } else if (type === "array") {
        value = parseArray(value)
        log("import", `Parsed array for ${db}:`, value)
      } else if (type === "number") {
        value = parseNumber(value)
      } else if (value !== undefined && value !== null) {
        value = String(value).trim()
      }

      obj[db] = value
    })

    if (Array.isArray(obj.tags)) {
      obj.tags = obj.tags
        .map((t: string) => tagMap[t.trim().toLowerCase()])
        .filter(Boolean)
      obj.tags = Array.from(new Set(obj.tags))
    }

    ;["phone", "phone2", "phone3"].forEach((p) => {
      if (obj[p] && typeof obj[p] !== "string") {
        obj[p] = String(obj[p])
      }
    })

    if (extraTags.length) {
      const extras = extraTags
        .map((t) => tagMap[t.toLowerCase()])
        .filter(Boolean)
      obj.tags = Array.from(new Set([...(obj.tags || []), ...extras]))
    }
    if (extraLocations.length) {
      obj.locations = Array.from(new Set([...(obj.locations || []), ...extraLocations]))
    }
    if (extraPropertyTypes.length) {
      obj.property_type = Array.from(
        new Set([...(obj.property_type || []), ...extraPropertyTypes]),
      )
    }

    if (!obj.status) obj.status = "lead"

    obj.email = normalizeEmail(obj.email)
    obj.phone = normalizePhone(obj.phone)
    obj.phone2 = normalizePhone(obj.phone2)
    obj.phone3 = normalizePhone(obj.phone3)

    log("import", `Final object for row ${index}:`, obj)
    return obj
  })

  log("import", "Buyers to insert:", buyersToInsert.slice(0, 2))

  // Collapse to at most one record per person within this single import. A CSV can
  // list the same person across multiple rows (e.g. one row per geotag); inserting
  // each separately violates the buyers unique constraint and aborts the whole
  // import. Merge duplicates in memory instead, keying on normalized email AND
  // normalized phone so a match on either field unifies the records.
  const ARRAY_FIELDS = ["tags", "locations", "property_type"] as const
  const collapsedBuyers: Record<string, any>[] = []
  const collapseMap: Record<string, Record<string, any>> = {}

  for (const row of buyersToInsert) {
    const email = normalizeEmail(row.email)
    const phone = normalizePhone(row.phone)
    const kept =
      (email && collapseMap["e:" + email]) ||
      (phone && collapseMap["p:" + phone]) ||
      null

    if (kept) {
      // Union the multi-value fields so no geotags/tags are lost on merge.
      for (const field of ARRAY_FIELDS) {
        if (row[field] != null) {
          kept[field] = mergeUnique(kept[field], row[field] as any[])
        }
      }
      // Fill any empty scalar field on the kept record from this row.
      for (const [key, val] of Object.entries(row)) {
        if ((ARRAY_FIELDS as readonly string[]).includes(key)) continue
        if (val === null || val === undefined || val === "") continue
        const current = kept[key]
        if (current === null || current === undefined || current === "") {
          kept[key] = val
        }
      }
    } else {
      collapsedBuyers.push(row)
    }

    // Register both the email and phone of the kept record. The kept record may
    // have just gained an email/phone from a merged row, so re-register each time.
    const target = kept || row
    const tEmail = normalizeEmail(target.email)
    const tPhone = normalizePhone(target.phone)
    if (tEmail) collapseMap["e:" + tEmail] = target
    if (tPhone) collapseMap["p:" + tPhone] = target
  }

  // Contactability gate: never import a buyer with neither an email nor a phone.
  const contactableBuyers = collapsedBuyers.filter(hasContactInfo)
  const skippedNoContact = collapsedBuyers.length - contactableBuyers.length

  const BATCH_SIZE = 50
  let processedCount = 0
  const insertedIds: string[] = []
  let totalInserted = 0
  let totalUpdated = 0

  for (let i = 0; i < contactableBuyers.length; i += BATCH_SIZE) {
    const batch = contactableBuyers.slice(i, i + BATCH_SIZE)

    const emails = Array.from(new Set(batch.map((b) => b.email).filter(Boolean)))
    const phones = Array.from(new Set(batch.map((b) => b.phone).filter(Boolean)))

    const existingMap: Record<string, any> = {}

    if (emails.length) {
      const { data, error } = await supabase.from("buyers").select("*").in("email_norm", emails)
      if (error) throw error
      data?.forEach((b) => {
        const key = normalizeEmail(b.email_norm || b.email)
        if (key) existingMap["e:" + key] = b
      })
    }

    if (phones.length) {
      const { data, error } = await supabase.from("buyers").select("*").in("phone_norm", phones)
      if (error) throw error
      data?.forEach((b) => {
        const key = normalizePhone(b.phone_norm || b.phone)
        if (key) existingMap["p:" + key] = b
      })
    }

    const inserts: any[] = []
    const updates: { id: string; data: any; existing: any; buyer: any }[] = []

    batch.forEach((buyer) => {
      const existing =
        (buyer.email && existingMap["e:" + buyer.email]) ||
        (buyer.phone && existingMap["p:" + buyer.phone])

      if (existing) {
        const updateData: Record<string, any> = {}
        Object.entries(buyer).forEach(([key, val]) => {
          if (val !== null && val !== "") {
            if (key === "tags") {
              updateData.tags = mergeUnique(existing.tags, val as any)
            } else if (key === "locations") {
              updateData.locations = mergeUnique(existing.locations, val as any)
            } else if (key === "property_type") {
              updateData.property_type = mergeUnique(existing.property_type, val as any)
            } else {
              updateData[key] = val
            }
          }
        })
        updateData.updated_at = new Date().toISOString()
        updates.push({ id: existing.id, data: updateData, existing, buyer })
      } else {
        inserts.push(buyer)
      }
    })

    if (inserts.length) {
      const response = await fetch("/api/buyers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyers: inserts }),
      })

      if (response.status === 403) {
        throw new Error("You don't have permission to import buyers.")
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to import buyers")
      }

      const result = await response.json()
      const ids = (result?.insertedIds || result?.ids || []) as string[]
      insertedIds.push(...ids)
      totalInserted += ids.length

    }

    if (updates.length) {
      const response = await fetch("/api/buyers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updates.map((u) => ({ id: u.id, data: u.data })) }),
      })

      if (response.status === 403) {
        throw new Error("You don't have permission to import buyers.")
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to update imported buyer")
      }

      const result = await response.json().catch(() => ({}))
      const updatedIds = (result?.updatedIds || []) as string[]
      insertedIds.push(...updatedIds)
      totalUpdated += updatedIds.length

    }

    processedCount += batch.length
    if (onProgress) onProgress(Math.round((processedCount / contactableBuyers.length) * 100))
  }

  if (groupIds.length && insertedIds.length) {
    await addBuyersToGroups(insertedIds, groupIds)
  }

  return { inserted: totalInserted, updated: totalUpdated, skipped: skippedNoContact }
}

interface ImportBuyersModalProps {
  onSuccess?: () => void
}

export default function ImportBuyersModal({ onSuccess }: ImportBuyersModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [csvRows, setCsvRows] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [extraTags, setExtraTags] = useState<string[]>([])
  const [extraLocations, setExtraLocations] = useState<string[]>([])
  const [extraPropertyTypes, setExtraPropertyTypes] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [templates, setTemplates] = useState<{ name: string; mapping: Record<string, string> }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [error, setError] = useState("")
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number }>({ inserted: 0, updated: 0, skipped: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    const stored = localStorage.getItem("buyerImportTemplates")
    if (stored) {
      try {
        setTemplates(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse templates", e)
      }
    }
  }, [])

  const saveTemplates = (list: { name: string; mapping: Record<string, string> }[]) => {
    setTemplates(list)
    localStorage.setItem("buyerImportTemplates", JSON.stringify(list))
  }

  const loadTemplate = (name: string) => {
    setSelectedTemplate(name)
    const temp = templates.find((t) => t.name === name)
    if (temp) {
      setMapping(temp.mapping)
      setTemplateName(temp.name)
    }
  }

  const handleSaveTemplate = () => {
    if (!templateName) return
    const idx = templates.findIndex((t) => t.name === templateName)
    let newTemplates = [...templates]
    if (idx >= 0) {
      newTemplates[idx] = { name: templateName, mapping }
    } else {
      newTemplates.push({ name: templateName, mapping })
    }
    saveTemplates(newTemplates)
    setSelectedTemplate(templateName)
  }

  const handleRenameTemplate = () => {
    if (!selectedTemplate || !templateName) return
    const idx = templates.findIndex((t) => t.name === selectedTemplate)
    if (idx === -1) return
    const newTemplates = [...templates]
    newTemplates[idx] = { name: templateName, mapping: newTemplates[idx].mapping }
    saveTemplates(newTemplates)
    setSelectedTemplate(templateName)
  }

  const handleDeleteTemplate = () => {
    if (!selectedTemplate) return
    const newTemplates = templates.filter((t) => t.name !== selectedTemplate)
    saveTemplates(newTemplates)
    setSelectedTemplate("")
    setTemplateName("")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: { data: Record<string, string>[]; meta: { fields?: string[] } }) => {
        log("parse", "Parsed CSV data:", res.data.slice(0, 3))
        setCsvRows(res.data)
        setHeaders(res.meta.fields || [])
        setStep(1)
      },
      error: (err: { message: string }) => {
        setError(`Failed to parse CSV file: ${err.message}`)
      },
    })
  }

  const handleMappingChange = (dbField: string, csvField: string) => {
    setMapping((prev) => ({ ...prev, [dbField]: csvField === "none" ? "" : csvField }))
  }

  const handleImport = async () => {
    setImporting(true)
    setImportProgress(0)
    setError("")
    // Move to the Importing → Done phase so the progress bar is visible.
    setStep(3)

    try {
      const result = await importBuyersFromCsv(
        csvRows,
        mapping,
        extraTags,
        extraLocations,
        extraPropertyTypes,
        groupIds,
        (p) => setImportProgress(p),
      )

      setImportResult(result)
      setCsvRows([])
      setMapping({})
      setExtraTags([])
      setExtraLocations([])
      setExtraPropertyTypes([])
      setGroupIds([])
      // Stay on step 3 to show the success screen.
    } catch (err: any) {
      console.error("Import error:", err)
      setError(err.message || "Import failed")
      // Return to Organize so the error shows alongside the form.
      setStep(2)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = FIELD_MAPPINGS.map((f) => f.label)
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "buyers_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const mappedCount = Object.keys(mapping).filter((k) => mapping[k] && mapping[k] !== "none").length

  const stepDescriptions = [
    "Upload a CSV file with your buyer data.",
    "Match your CSV columns to the correct fields.",
    "Add tags, locations, property types and groups to every imported buyer.",
    importing ? "Importing your buyers — this may take a moment." : "Your import is complete.",
  ]

  const handleBack = () => {
    if (step === 0) {
      setOpen(false)
    } else {
      setStep(step - 1)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setStep(0)
    if (onSuccess) onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Can permission="buyers.import">
        <DialogTrigger asChild>
          <Button className="btn-primary">
            <FileUp className="mr-2 h-4 w-4" /> Import Buyers
          </Button>
        </DialogTrigger>
      </Can>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import buyers</DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 py-2">
          {PHASES.map((label, i) => {
            const completed = i < step
            const active = i === step
            return (
              <div key={label} className="flex flex-1 items-center gap-1.5">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      completed
                        ? "bg-[#16a34a] text-white"
                        : active
                          ? "bg-brand text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "hidden text-sm sm:inline",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < PHASES.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            )
          })}
        </div>

        {/* Step 0 — Upload */}
        {step === 0 && (
          <div className="grid gap-6 py-2">
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                <FileUp className="h-7 w-7 text-brand" />
              </div>
              <h3 className="mb-1 text-base font-medium text-foreground">Import buyers from CSV</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Drag a CSV here or click to browse · Supports name, email, phone, tags, locations
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="brand"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  Select file
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadTemplate()
                  }}
                >
                  Download template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Map fields */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <h4 className="mb-2 text-sm font-medium">Mapping template</h4>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedTemplate} onValueChange={loadTemplate}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Load a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="h-9 w-44"
                />
                <Button size="sm" onClick={handleSaveTemplate} disabled={!templateName}>
                  Save
                </Button>
                {selectedTemplate && (
                  <>
                    <Button size="sm" variant="outline" onClick={handleRenameTemplate}>
                      Rename
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleDeleteTemplate}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">App field</th>
                    <th className="p-3">Your CSV column</th>
                    <th className="p-3">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_MAPPINGS.map(({ db, label, type }) => {
                    const sample =
                      mapping[db] && csvRows.length > 0 ? String(csvRows[0][mapping[db]] || "") : ""
                    return (
                      <tr key={db} className="border-b border-border last:border-0">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{label}</span>
                            {type && (
                              <Badge variant="outline" className="text-xs">
                                {type === "array" ? "list" : type}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={mapping[db] || "none"}
                            onValueChange={(value) => handleMappingChange(db, value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Not mapped" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not mapped</SelectItem>
                              {headers.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          {sample ? (
                            <span className="inline-block max-w-[16rem] truncate rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground align-middle">
                              {sample.slice(0, 30)}
                              {sample.length > 30 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No preview</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              For best results, map as many fields as possible. Tags and locations should be comma-separated values.
            </p>
          </div>
        )}

        {/* Step 2 — Organize */}
        {step === 2 && (
          <div className="grid gap-5 py-2">
            <div>
              <h4 className="mb-1.5 text-sm font-medium">Add tags</h4>
              <TagSelector value={extraTags} onChange={setExtraTags} />
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium">Add locations</h4>
              <LocationSelector value={extraLocations} onChange={setExtraLocations} />
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium">Add property types</h4>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((type) => {
                  const selected = extraPropertyTypes.includes(type)
                  return (
                    <Badge
                      key={type}
                      variant={selected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer",
                        selected && "bg-brand text-white hover:bg-brand-hover",
                      )}
                      onClick={() =>
                        setExtraPropertyTypes((prev) =>
                          prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
                        )
                      }
                    >
                      {type}
                    </Badge>
                  )
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium">Assign to groups</h4>
              <GroupTreeSelector value={groupIds} onChange={setGroupIds} />
            </div>
          </div>
        )}

        {/* Step 3 — Importing → Done */}
        {step === 3 && (
          <div className="py-6">
            {importing ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  <span>Importing buyers…</span>
                  <span className="ml-auto text-muted-foreground">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]/10">
                  <CheckCircle2 className="h-8 w-8 text-[#16a34a]" />
                </div>
                <h3 className="text-base font-medium text-foreground">Import complete</h3>
                <p className="text-sm text-muted-foreground">
                  {importResult.inserted} new buyers created · {importResult.updated} existing buyers updated.
                  {importResult.skipped > 0 && ` · ${importResult.skipped} skipped (no email or phone)`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error (not shown on the Done screen) */}
        {error && step !== 3 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Footer */}
        {step < 3 && (
          <DialogFooter className="mt-6 flex items-center sm:justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={importing}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <span className="text-xs text-muted-foreground">Step {step + 1} of 3</span>
            {step === 2 ? (
              <Button variant="brand" onClick={handleImport} disabled={importing || mappedCount === 0}>
                Import {csvRows.length} buyers
              </Button>
            ) : (
              <Button
                variant="brand"
                onClick={() => setStep(step + 1)}
                disabled={(step === 0 && csvRows.length === 0) || (step === 1 && mappedCount === 0)}
              >
                Next
              </Button>
            )}
          </DialogFooter>
        )}

        {step === 3 && !importing && (
          <DialogFooter className="mt-6">
            <Button variant="brand" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}