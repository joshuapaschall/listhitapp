"use client"

import { useMemo, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { Bath, Bed, Building2, CheckCircle2, Clock, DollarSign, Grid3X3, Home, LinkIcon, List, Pencil, Ruler, Eye } from "lucide-react"
import { PropertyService } from "@/services/property-service"
import type { Property, PropertyImage } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import MainLayout from "@/components/layout/main-layout"
import { Can } from "@/components/auth/Can"
import { useDebounce } from "@/hooks/use-debounce"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import PropertyDetailModal from "@/components/properties/property-detail-modal"
import { toast } from "sonner"

const STATUSES = ["all", "available", "under_contract", "sold"]
const ITEMS_PER_PAGE = 12

type PropertyWithImages = Property & {
  property_images?: Pick<PropertyImage, "id" | "image_url" | "sort_order" | "is_featured">[]
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

const statusStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  under_contract: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  sold: "bg-blue-100 text-blue-800 hover:bg-blue-100",
}

const FINANCE_SUBTYPE_LABEL: Record<string, string> = {
  owner_finance: "Owner finance",
  subject_to: "Subject-to",
  land_contract: "Land contract",
}

// Deal-type badge: creative → finance-subtype label (purple), cash → neutral.
const dealBadge = (p: Property) => {
  if (p.deal_type === "creative") {
    const label = (p.finance_subtype && FINANCE_SUBTYPE_LABEL[p.finance_subtype]) || "Creative"
    return { label, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400" }
  }
  return { label: "Cash", className: "bg-muted text-muted-foreground" }
}

const statusLabel = (status?: string | null) => {
  if (!status) return "Unknown"
  return status.replaceAll("_", " ")
}

const formatPrice = (value?: number | null) => {
  if (!value) return "-"
  return usdFormatter.format(value)
}

function SpreadChip({ spread }: { spread: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        spread >= 0
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      {spread >= 0 ? "+" : "−"}
      {usdFormatter.format(Math.abs(spread))}
    </span>
  )
}

export default function PropertiesPage() {
  const queryClient = useQueryClient()
  const { can, loading: permissionsLoading } = usePermissions()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const minPriceNumber = minPrice.trim() === "" ? undefined : Number(minPrice)
  const maxPriceNumber = maxPrice.trim() === "" ? undefined : Number(maxPrice)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter !== "all") count += 1
    if (debouncedSearch.trim()) count += 1
    if (cityFilter.trim()) count += 1
    if (minPrice.trim()) count += 1
    if (maxPrice.trim()) count += 1
    return count
  }, [statusFilter, debouncedSearch, cityFilter, minPrice, maxPrice])

  const generateLink = async (prop: Property) => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
    try {
      // POSTs to /api/short-links → services/shortlink-service.ts (native short-link service)
      const res = await fetch("/api/short-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalURL: prop.website_url || `${baseUrl}/properties/${prop.id}`,
          path: prop.short_slug || undefined,
        }),
      })
      if (!res.ok) throw new Error("Request failed")
      const { shortURL, path, idString } = await res.json()
      await PropertyService.updateProperty(prop.id, {
        short_url_key: path,
        short_url: shortURL,
        short_slug: path,
        shortio_link_id: idString,
      })
      queryClient.invalidateQueries({ queryKey: ["properties"] })
      toast.success("Short link generated")
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate link")
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["properties", statusFilter, debouncedSearch, cityFilter, minPriceNumber, maxPriceNumber, currentPage],
    queryFn: () =>
      PropertyService.getProperties({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch.trim() || undefined,
        city: cityFilter.trim() || undefined,
        minPrice: Number.isFinite(minPriceNumber) ? minPriceNumber : undefined,
        maxPrice: Number.isFinite(maxPriceNumber) ? maxPriceNumber : undefined,
        page: currentPage,
        perPage: ITEMS_PER_PAGE,
      }),
    placeholderData: keepPreviousData,
    enabled: !permissionsLoading && can("properties.view"),
  })

  const properties = useMemo(() => (data?.properties ?? []) as PropertyWithImages[], [data?.properties])
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const stats = useMemo(() => {
    const available = properties.filter((p) => p.status === "available").length
    const underContract = properties.filter((p) => p.status === "under_contract").length
    // Inventory value = sum of price across non-sold (available + under_contract) properties.
    const inventoryValue = properties
      .filter((p) => p.status !== "sold")
      .reduce((sum, p) => sum + (p.price || 0), 0)
    return { available, underContract, inventoryValue }
  }, [properties])

  const toggleSelectAll = () => {
    if (selectedIds.length === properties.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(properties.map((p) => p.id))
    }
  }

  const clearFilters = () => {
    setCurrentPage(1)
    setStatusFilter("all")
    setSearch("")
    setCityFilter("")
    setMinPrice("")
    setMaxPrice("")
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]))
  }

  const openDetails = (id: string) => {
    setDetailId(id)
    setShowDetailModal(true)
  }

  const handleBulkDelete = async () => {
    await Promise.all(selectedIds.map((id) => PropertyService.deleteProperty(id)))
    setSelectedIds([])
    queryClient.invalidateQueries({ queryKey: ["properties"] })
  }

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="p-4 text-sm text-muted-foreground">Checking property permissions...</div>
      </MainLayout>
    )
  }

  if (!can("properties.view")) {
    return (
      <MainLayout>
        <div className="space-y-2 p-4">
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-muted-foreground">You do not have permission to view properties.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-bold">Properties</h1>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Can permission="properties.manage">
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                  Delete Selected ({selectedIds.length})
                </Button>
              </Can>
            )}
            <Can permission="properties.manage">
              <Button asChild>
                <Link href="/properties/add">Add Property</Link>
              </Button>
            </Can>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <p className="text-xs">Total properties</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-foreground">{totalCount}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <p className="text-xs">Available</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-emerald-600 dark:text-emerald-400">{stats.available}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <p className="text-xs">Under contract</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-amber-600 dark:text-amber-400">{stats.underContract}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <p className="text-xs">Inventory value</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-foreground">{compactUsdFormatter.format(stats.inventoryValue)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div><label className="mb-1 block text-xs text-muted-foreground">Status</label><Select value={statusFilter} onValueChange={(v) => { setCurrentPage(1); setStatusFilter(v) }}><SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All" : statusLabel(s)}</SelectItem>)}</SelectContent></Select></div>
            <div><label htmlFor="property-search" className="mb-1 block text-xs text-muted-foreground">Search</label><Input id="property-search" placeholder="Address, city, state, or zip" value={search} onChange={(e) => { setCurrentPage(1); setSearch(e.target.value) }} className="h-9 w-56" /></div>
            <div><label htmlFor="city-filter" className="mb-1 block text-xs text-muted-foreground">City</label><Input id="city-filter" value={cityFilter} onChange={(e) => { setCurrentPage(1); setCityFilter(e.target.value) }} className="h-9 w-40" /></div>
            <div><label htmlFor="min-price" className="mb-1 block text-xs text-muted-foreground">Min price</label><Input id="min-price" type="number" value={minPrice} onChange={(e) => { setCurrentPage(1); setMinPrice(e.target.value) }} className="h-9 w-36" /></div>
            <div><label htmlFor="max-price" className="mb-1 block text-xs text-muted-foreground">Max price</label><Input id="max-price" type="number" value={maxPrice} onChange={(e) => { setCurrentPage(1); setMaxPrice(e.target.value) }} className="h-9 w-36" /></div>
            {activeFilterCount > 0 && (
              <Button variant="outline" className="h-9" onClick={clearFilters}>
                Clear filters
                <Badge className="ml-2 rounded-full bg-brand px-2 py-0 text-xs text-white hover:bg-brand">
                  {activeFilterCount}
                </Badge>
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={cn("flex h-7 w-7 items-center justify-center rounded-md", viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn("flex h-7 w-7 items-center justify-center rounded-md", viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "grid" ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Can permission="properties.manage">
                <Checkbox checked={selectedIds.length === properties.length && properties.length > 0} onCheckedChange={toggleSelectAll} />
                <span className="text-sm text-muted-foreground">Select all on this page</span>
              </Can>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => {
                const images = (property.property_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                const featured = images.find((img) => img.is_featured)
                const firstImage = (featured || images[0])?.image_url
                const isCreative = property.deal_type === "creative"
                const spread = property.buy_price != null && property.price != null ? property.price - property.buy_price : null
                const badge = dealBadge(property)
                const termsLine = [
                  property.monthly_payment != null ? `${usdFormatter.format(property.monthly_payment)}/mo` : null,
                  property.interest_rate != null ? `${property.interest_rate}%` : null,
                ].filter(Boolean).join(" · ")
                return (
                  <Card key={property.id} className="group cursor-pointer overflow-hidden border-border" onClick={() => openDetails(property.id)}>
                    <div className="relative h-48 w-full bg-muted">
                      {firstImage ? <Image src={firstImage} alt={property.address || "Property"} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" /> : <div className="flex h-full items-center justify-center bg-muted"><Home className="h-8 w-8 text-muted-foreground" /></div>}
                      <Badge className={`absolute left-2 top-2 ${statusStyles[property.status || ""] || ""}`}>{statusLabel(property.status)}</Badge>
                      <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>{badge.label}</span>
                      <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/35 group-hover:flex">
                        <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); openDetails(property.id) }}><Eye className="h-4 w-4" /></Button>
                        <Can permission="properties.manage">
                          <Button asChild size="icon" variant="secondary" onClick={(e) => e.stopPropagation()}><Link href={`/properties/edit/${property.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                          <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); generateLink(property) }}><LinkIcon className="h-4 w-4" /></Button>
                        </Can>
                      </div>
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">{property.address || "-"}</div>
                          <div className="truncate text-sm text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(", ") || "-"}</div>
                        </div>
                        <Can permission="properties.manage">
                          <Checkbox checked={selectedIds.includes(property.id)} onCheckedChange={() => toggleSelect(property.id)} onClick={(e) => e.stopPropagation()} />
                        </Can>
                      </div>

                      {isCreative ? (
                        <div>
                          <div className="text-lg font-semibold text-foreground">{formatPrice(property.price)}</div>
                          {termsLine ? <div className="text-xs text-muted-foreground">{termsLine}</div> : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-foreground">{formatPrice(property.price)}</span>
                          {spread != null ? <SpreadChip spread={spread} /> : null}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.bedrooms || 0}</span>
                        <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.bathrooms || 0}</span>
                        <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{(property.sqft || 0).toLocaleString()}</span>
                      </div>

                      {property.disposition_strategy ? (
                        <div className="border-t border-border pt-2">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{property.disposition_strategy}</span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10"><Can permission="properties.manage"><Checkbox checked={selectedIds.length === properties.length && properties.length > 0} onCheckedChange={toggleSelectAll} /></Can></TableHead><TableHead>Property</TableHead><TableHead>Price</TableHead><TableHead>Spread</TableHead><TableHead>Deal type</TableHead><TableHead>Specs</TableHead><TableHead>Status</TableHead><TableHead className="w-40">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {properties.map((property) => {
                  const images = (property.property_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                  const featured = images.find((img) => img.is_featured)
                  const firstImage = (featured || images[0])?.image_url
                  const spread = property.buy_price != null && property.price != null ? property.price - property.buy_price : null
                  const badge = dealBadge(property)
                  return (
                    <TableRow key={property.id}>
                      <TableCell><Can permission="properties.manage"><Checkbox checked={selectedIds.includes(property.id)} onCheckedChange={() => toggleSelect(property.id)} /></Can></TableCell>
                      <TableCell><div className="flex items-center gap-3"><div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">{firstImage ? <Image src={firstImage} alt={property.address || "Property"} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" /> : <div className="flex h-full items-center justify-center bg-muted"><Home className="h-5 w-5 text-muted-foreground" /></div>}</div><div><div className="font-medium">{property.address}</div><div className="text-sm text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(", ")}</div></div></div></TableCell>
                      <TableCell>{formatPrice(property.price)}</TableCell>
                      <TableCell>{spread == null ? <span className="text-muted-foreground">—</span> : <span className={spread >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{spread >= 0 ? "+" : "−"}{usdFormatter.format(Math.abs(spread))}</span>}</TableCell>
                      <TableCell><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>{badge.label}</span></TableCell>
                      <TableCell>{`${property.bedrooms || 0} bd • ${property.bathrooms || 0} ba • ${(property.sqft || 0).toLocaleString()} sqft`}</TableCell>
                      <TableCell><Badge className={statusStyles[property.status || ""] || ""}>{statusLabel(property.status)}</Badge></TableCell>
                      <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openDetails(property.id)}>View</Button><Can permission="properties.manage"><Button asChild size="sm" variant="outline"><Link href={`/properties/edit/${property.id}`}>Edit</Link></Button></Can></div></TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && properties.length === 0 && <TableRow><TableCell colSpan={8}>No properties found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        )}

        {isLoading && <div className="text-sm text-muted-foreground">Loading properties...</div>}

        {totalPages > 1 && (
          <Pagination className="mt-2">
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.max(1, currentPage - 1)) }} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => <PaginationItem key={i}><PaginationLink href="#" isActive={currentPage === i + 1} onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1) }}>{i + 1}</PaginationLink></PaginationItem>)}
              <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.min(totalPages, currentPage + 1)) }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        <ConfirmInputDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Properties" description={`You are about to delete ${selectedIds.length} properties.`} confirmationText="delete" actionText="Delete" onConfirm={handleBulkDelete} />


        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">Failed to load properties</p>
            <p className="mt-1 text-xs text-red-500">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}
        <PropertyDetailModal open={showDetailModal} onOpenChange={(o) => { if (!o) setDetailId(null); setShowDetailModal(o) }} propertyId={detailId} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["properties"] })} />
      </div>
    </MainLayout>
  )
}
