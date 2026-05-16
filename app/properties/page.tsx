"use client"

import { useMemo, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { Grid3X3, Home, LinkIcon, List, Pencil, Eye } from "lucide-react"
import { PropertyService } from "@/services/property-service"
import type { Property, PropertyImage } from "@/lib/supabase"
import MainLayout from "@/components/layout/main-layout"
import { useDebounce } from "@/hooks/use-debounce"
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

const statusStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  under_contract: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  sold: "bg-blue-100 text-blue-800 hover:bg-blue-100",
}

const statusLabel = (status?: string | null) => {
  if (!status) return "Unknown"
  return status.replaceAll("_", " ")
}

const formatPrice = (value?: number | null) => {
  if (!value) return "-"
  return usdFormatter.format(value)
}

export default function PropertiesPage() {
  const queryClient = useQueryClient()
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
  })

  const properties = useMemo(() => (data?.properties ?? []) as PropertyWithImages[], [data?.properties])
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const stats = useMemo(() => {
    const available = properties.filter((p) => p.status === "available").length
    const underContract = properties.filter((p) => p.status === "under_contract").length
    const sold = properties.filter((p) => p.status === "sold").length
    return { available, underContract, sold }
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

  return (
    <MainLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-bold">Properties</h1>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Button asChild>
              <Link href="/properties/add">Add Property</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Properties</p><p className="text-2xl font-bold">{totalCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Available</p><p className="text-2xl font-bold text-emerald-600">{stats.available}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Under Contract</p><p className="text-2xl font-bold text-amber-600">{stats.underContract}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sold</p><p className="text-2xl font-bold text-blue-600">{stats.sold}</p></CardContent></Card>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div><label className="mb-1 block text-sm">Status</label><Select value={statusFilter} onValueChange={(v) => { setCurrentPage(1); setStatusFilter(v) }}><SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All" : statusLabel(s)}</SelectItem>)}</SelectContent></Select></div>
            <div><label htmlFor="property-search" className="mb-1 block text-sm">Search</label><Input id="property-search" placeholder="Address, city, state, or zip" value={search} onChange={(e) => { setCurrentPage(1); setSearch(e.target.value) }} className="w-56" /></div>
            <div><label htmlFor="city-filter" className="mb-1 block text-sm">City</label><Input id="city-filter" value={cityFilter} onChange={(e) => { setCurrentPage(1); setCityFilter(e.target.value) }} className="w-40" /></div>
            <div><label htmlFor="min-price" className="mb-1 block text-sm">Min Price</label><Input id="min-price" type="number" value={minPrice} onChange={(e) => { setCurrentPage(1); setMinPrice(e.target.value) }} className="w-36" /></div>
            <div><label htmlFor="max-price" className="mb-1 block text-sm">Max Price</label><Input id="max-price" type="number" value={maxPrice} onChange={(e) => { setCurrentPage(1); setMaxPrice(e.target.value) }} className="w-36" /></div>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
                <Badge className="ml-2 rounded-full bg-blue-600 px-2 py-0 text-xs text-white hover:bg-blue-600">
                  {activeFilterCount}
                </Badge>
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1 rounded-md border p-1">
              <Button size="icon" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")}><Grid3X3 className="h-4 w-4" /></Button>
              <Button size="icon" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {viewMode === "grid" ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Checkbox checked={selectedIds.length === properties.length && properties.length > 0} onCheckedChange={toggleSelectAll} />
              <span className="text-sm text-muted-foreground">Select all on this page</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => {
                const images = (property.property_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                const featured = images.find((img) => img.is_featured)
                const firstImage = (featured || images[0])?.image_url
                return (
                  <Card key={property.id} className="group cursor-pointer overflow-hidden" onClick={() => openDetails(property.id)}>
                    <div className="relative h-48 w-full bg-muted">
                      {firstImage ? <Image src={firstImage} alt={property.address || "Property"} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><Home className="h-8 w-8 text-slate-500" /></div>}
                      <Badge className={`absolute right-2 top-2 ${statusStyles[property.status || ""] || ""}`}>{statusLabel(property.status)}</Badge>
                      <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/35 group-hover:flex">
                        <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); openDetails(property.id) }}><Eye className="h-4 w-4" /></Button>
                        <Button asChild size="icon" variant="secondary" onClick={(e) => e.stopPropagation()}><Link href={`/properties/edit/${property.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                        <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); generateLink(property) }}><LinkIcon className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{property.address || "-"}</div>
                          <div className="text-sm text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(", ") || "-"}</div>
                        </div>
                        <Checkbox checked={selectedIds.includes(property.id)} onCheckedChange={() => toggleSelect(property.id)} onClick={(e) => e.stopPropagation()} />
                      </div>
                      <div className="text-lg font-bold">{formatPrice(property.price)}</div>
                      <div className="inline-flex rounded-full bg-muted px-3 py-1 text-xs">{`${property.bedrooms || 0} bd • ${property.bathrooms || 0} ba • ${(property.sqft || 0).toLocaleString()} sqft`}</div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={selectedIds.length === properties.length && properties.length > 0} onCheckedChange={toggleSelectAll} /></TableHead><TableHead>Property</TableHead><TableHead>Price</TableHead><TableHead>Specs</TableHead><TableHead>Status</TableHead><TableHead className="w-40">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {properties.map((property) => {
                  const images = (property.property_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                  const featured = images.find((img) => img.is_featured)
                  const firstImage = (featured || images[0])?.image_url
                  return (
                    <TableRow key={property.id}>
                      <TableCell><Checkbox checked={selectedIds.includes(property.id)} onCheckedChange={() => toggleSelect(property.id)} /></TableCell>
                      <TableCell><div className="flex items-center gap-3"><div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">{firstImage ? <Image src={firstImage} alt={property.address || "Property"} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><Home className="h-5 w-5 text-slate-500" /></div>}</div><div><div className="font-medium">{property.address}</div><div className="text-sm text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(", ")}</div></div></div></TableCell>
                      <TableCell>{formatPrice(property.price)}</TableCell>
                      <TableCell>{`${property.bedrooms || 0} bd • ${property.bathrooms || 0} ba • ${(property.sqft || 0).toLocaleString()} sqft`}</TableCell>
                      <TableCell><Badge className={statusStyles[property.status || ""] || ""}>{statusLabel(property.status)}</Badge></TableCell>
                      <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openDetails(property.id)}>View</Button><Button asChild size="sm" variant="outline"><Link href={`/properties/edit/${property.id}`}>Edit</Link></Button></div></TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && properties.length === 0 && <TableRow><TableCell colSpan={6}>No properties found.</TableCell></TableRow>}
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
