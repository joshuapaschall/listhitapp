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
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileUp, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("import-buyers-modal")

import { normalizeEmail, normalizePhone, mergeUnique } from "@/lib/dedup-utils"
import TagSelector from "./tag-selector"
import { PROPERTY_TYPES } from "@/lib/constant"
import LocationSelector from "./location-selector"
import GroupTreeSelector from "./group-tree-selector"
import { addBuyersToGroups } from "@/lib/group-service"

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
): Promise<{ inserted: number; updated: number }> {
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

  const BATCH_SIZE = 50
  let processedCount = 0
  const insertedIds: string[] = []
  let totalInserted = 0
  let totalUpdated = 0

  for (let i = 0; i < buyersToInsert.length; i += BATCH_SIZE) {
    const batch = buyersToInsert.slice(i, i + BATCH_SIZE)

    const emails = batch.map((b) => b.email).filter(Boolean)
    const phones = batch.map((b) => b.phone).filter(Boolean)

    const existingMap: Record<string, any> = {}

    if (emails.length) {
      const { data } = await supabase.from("buyers").select("*").in("email", emails)
      data?.forEach((b) => {
        const key = normalizeEmail(b.email)
        if (key) existingMap["e:" + key] = b
      })
    }

    if (phones.length) {
      const { data } = await supabase.from("buyers").select("*").in("phone", phones)
      data?.forEach((b) => {
        const key = normalizePhone(b.phone)
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
      const { data, error } = await supabase
        .from("buyers")
        .insert(inserts)
        .select("id")

      if (error) {
        console.error("Insert error:", error)
        throw error
      }

      if (data) {
        insertedIds.push(...data.map((b: any) => b.id))
        totalInserted += data.length
        for (let i = 0; i < inserts.length; i++) {
          const b = inserts[i]
          const id = data[i]?.id
          if (b.email && id) {
            const lists: number[] = []
            if (process.env.SENDFOX_DEFAULT_LIST_ID) {
              lists.push(Number(process.env.SENDFOX_DEFAULT_LIST_ID))
            }
            try {
              const res = await fetch("/api/sendfox/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: b.email,
                  first_name: b.fname,
                  lists,
                }),
              })
              const sf = await res.json()
              if (sf?.id) {
                await supabase
                  .from("buyers")
                  .update({ sendfox_contact_id: sf.id })
                  .eq("id", id)
              }
            } catch (err) {
              console.error("SendFox sync error", err)
            }
          }
        }
      }
    }

    for (const u of updates) {
      const { error } = await supabase
        .from("buyers")
        .update(u.data)
        .eq("id", u.id)

      if (error) {
        console.error("Update error:", error)
        throw error
      }

      insertedIds.push(u.id)
      totalUpdated += 1
      const email = u.existing.email || u.buyer.email
      if (email) {
        const lists: number[] = []
        if (process.env.SENDFOX_DEFAULT_LIST_ID) {
          lists.push(Number(process.env.SENDFOX_DEFAULT_LIST_ID))
        }
        try {
          const res = await fetch("/api/sendfox/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              first_name:
                u.data.fname || u.existing.fname || u.buyer.fname,
              lists,
            }),
          })
          const sf = await res.json()
          if (sf?.id) {
            await supabase
              .from("buyers")
              .update({ sendfox_contact_id: sf.id })
              .eq("id", u.id)
          }
        } catch (err) {
          console.error("SendFox sync error", err)
        }
      }
    }

    processedCount += batch.length
    if (onProgress) onProgress(Math.round((processedCount / buyersToInsert.length) * 100))
  }

  if (groupIds.length && insertedIds.length) {
    await addBuyersToGroups(insertedIds, groupIds)
  }

  return { inserted: totalInserted, updated: totalUpdated }
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
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number }>({ inserted: 0, updated: 0 })
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
      complete: (res) => {
        log("parse", "Parsed CSV data:", res.data.slice(0, 3))
        setCsvRows(res.data)
        setHeaders(res.meta.fields || [])
        setStep(1)
      },
      error: (err) => {
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
      setStep(2)
    } catch (err: any) {
      console.error("Import error:", err)
      setError(err.message || "Import failed")
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary">
          <FileUp className="mr-2 h-4 w-4" /> Import Buyers
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {step === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Import Buyers</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your buyer data. You&apos;ll be able to map fields in the next step.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <Card className="border-dashed border-2 border-green-300 bg-green-50/50 hover:bg-green-50 transition-colors cursor-pointer">
                <CardContent className="pt-6 text-center">
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  <FileUp className="mx-auto h-12 w-12 text-green-600 mb-4" />
                  <h3 className="text-lg font-medium text-green-800 mb-2">Import Buyers from CSV</h3>
                  <p className="text-sm text-green-600 mb-6">
                    Drag CSV file here or click to browse • Supports: Name, Email, Phone, Tags, Locations
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-100"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                    <Button variant="ghost" className="text-green-600 hover:bg-green-100" onClick={downloadTemplate}>
                      Download Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </>
        ) : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Import {csvRows.length} Buyers</DialogTitle>
              <DialogDescription>Map your CSV columns to the correct fields.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Mapping Template</h4>
                <div className="flex items-center gap-2">
                  <Select value={selectedTemplate} onValueChange={loadTemplate}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="border px-2 py-1 rounded-md text-sm"
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

              <h3 className="text-lg font-semibold">Map CSV Columns</h3>

              <div className="border rounded-md">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">App Field</th>
                      <th className="text-left p-2 font-medium">Your CSV Column</th>
                      <th className="text-left p-2 font-medium">Sample Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELD_MAPPINGS.map(({ db, label, type }) => (
                      <tr key={db} className="border-b last:border-0">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{label}</span>
                            {type && (
                              <Badge variant="outline" className="text-xs">
                                {type === "array" ? "list" : type}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <Select
                            value={mapping[db] || "none"}
                            onValueChange={(value) => handleMappingChange(db, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="-- Not mapped --" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- Not mapped --</SelectItem>
                              {headers.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {mapping[db] && csvRows.length > 0 ? (
                            <span className="font-mono bg-muted px-2 py-1 rounded">
                              {String(csvRows[0][mapping[db]] || "").slice(0, 30)}
                              {String(csvRows[0][mapping[db]] || "").length > 30 ? "..." : ""}
                            </span>
                          ) : (
                            "No preview"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Note:</strong> For best results, map as many fields as possible. Tags and Locations should be
                  comma-separated values.
                </p>
              </div>

              <div className="grid gap-4 mt-4">
                <div>
                  <h4 className="font-semibold mb-1">Add Tags</h4>
                  <TagSelector value={extraTags} onChange={setExtraTags} />
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Add Locations</h4>
                  <LocationSelector value={extraLocations} onChange={setExtraLocations} />
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Add Property Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {PROPERTY_TYPES.map((type) => (
                      <Badge
                        key={type}
                        variant={extraPropertyTypes.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setExtraPropertyTypes((prev) =>
                            prev.includes(type)
                              ? prev.filter((t) => t !== type)
                              : [...prev, type]
                          )
                        }
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Assign to Groups</h4>
                  <GroupTreeSelector value={groupIds} onChange={setGroupIds} />
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {importing && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing buyers...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  importing || Object.keys(mapping).filter((k) => mapping[k] && mapping[k] !== "none").length === 0
                }
                className="bg-green-600 hover:bg-green-700"
              >
                {importing ? "Importing..." : `Import ${csvRows.length} Buyers`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm">{importResult.inserted} new buyers created.</p>
              <p className="text-sm">{importResult.updated} existing buyers updated.</p>
            </div>

            <DialogFooter className="mt-6">
              <Button
                onClick={() => {
                  setOpen(false)
                  setStep(0)
                  if (onSuccess) onSuccess()
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}