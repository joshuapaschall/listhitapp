"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { PropertyService } from "@/services/property-service"
import type { Property } from "@/lib/supabase"
import MainLayout from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
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
const ITEMS_PER_PAGE = 10

export default function PropertiesPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [cityFilter, setCityFilter] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

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

  const { data, isLoading } = useQuery({
    queryKey: [
      "properties",
      statusFilter,
      search,
      cityFilter,
      minPrice,
      maxPrice,
    ],
    queryFn: () =>
      PropertyService.getProperties({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
        city: cityFilter || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      }),
  })

  const properties = data?.properties ?? []

  const totalActive = properties.filter((p) => p.status === "available").length
  const pageCount = Math.ceil(properties.length / ITEMS_PER_PAGE) || 1
  const paged = properties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const toggleSelectAll = () => {
    if (selectedIds.length === paged.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paged.map((p) => p.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    )
  }

  const handleBulkDelete = async () => {
    await Promise.all(selectedIds.map((id) => PropertyService.deleteProperty(id)))
    setSelectedIds([])
    queryClient.invalidateQueries({ queryKey: ["properties"] })
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <h1 className="text-2xl font-bold">Properties</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{totalActive} Active</span>
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

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setCurrentPage(1)
                setStatusFilter(v)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="property-search" className="block text-sm mb-1">Search</label>
            <Input
              id="property-search"
              name="property-search"
              placeholder="Address, city, state, or zip"
              value={search}
              onChange={(e) => {
                setCurrentPage(1)
                setSearch(e.target.value)
              }}
              className="w-48"
            />
          </div>
          <div>
            <label htmlFor="city-filter" className="block text-sm mb-1">City</label>
            <Input
              id="city-filter"
              name="city-filter"
              value={cityFilter}
              onChange={(e) => {
                setCurrentPage(1)
                setCityFilter(e.target.value)
              }}
              className="w-40"
            />
          </div>
          <div>
            <label htmlFor="min-price" className="block text-sm mb-1">Min Price</label>
            <Input
              id="min-price"
              name="min-price"
              type="number"
              value={minPrice}
              onChange={(e) => {
                setCurrentPage(1)
                setMinPrice(e.target.value)
              }}
              className="w-32"
            />
          </div>
          <div>
            <label htmlFor="max-price" className="block text-sm mb-1">Max Price</label>
            <Input
              id="max-price"
              name="max-price"
              type="number"
              value={maxPrice}
              onChange={(e) => {
                setCurrentPage(1)
                setMaxPrice(e.target.value)
              }}
              className="w-32"
            />
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === paged.length && paged.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all properties on this page"
                  />
                </TableHead>
                <TableHead className="w-64">Address</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No properties found.</TableCell>
                </TableRow>
              )}
              {paged.map((property: Property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(property.id)}
                      onCheckedChange={() => toggleSelect(property.id)}
                      aria-label={`Select property at ${property.address}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{property.address}</div>
                    <div className="text-sm text-muted-foreground">
                      {[property.city, property.state, property.zip]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </TableCell>
                  <TableCell>{property.price ? `$${property.price}` : "-"}</TableCell>
                  <TableCell>{property.status.replace("_", " ")}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm text-muted-foreground">
                    {new Date(property.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetailId(property.id)
                          setShowDetailModal(true)
                        }}
                      >
                        View
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/properties/edit/${property.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateLink(property)}
                      >
                        Generate Short Link
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pageCount > 1 && (
          <Pagination className="mt-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(Math.max(1, currentPage - 1)) }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: pageCount }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1) }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(Math.min(pageCount, currentPage + 1)) }}
                  className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        <ConfirmInputDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Properties"
          description={`You are about to delete ${selectedIds.length} properties.`}
          confirmationText="delete"
          actionText="Delete"
          onConfirm={handleBulkDelete}
        />

        <PropertyDetailModal
          open={showDetailModal}
          onOpenChange={(o) => {
            if (!o) setDetailId(null)
            setShowDetailModal(o)
          }}
          propertyId={detailId}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["properties"] })}
        />
      </div>
    </MainLayout>
  )
}
