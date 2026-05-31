"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Can } from "@/components/auth/Can"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"
import ShowingCard from "@/components/showings/showing-card"
import ShowingStatusBadge from "@/components/showings/showing-status-badge"

interface ShowingsListViewProps {
  showings: ShowingWithRelations[]
  onEdit: (showing: ShowingWithRelations) => void
  onDelete: (showing: ShowingWithRelations) => void
  onBuyerClick: (buyer: Buyer) => void
  isLoading: boolean
}

const ITEMS_PER_PAGE = 10

export default function ShowingsListView({ showings, onEdit, onDelete, onBuyerClick, isLoading }: ShowingsListViewProps) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [showings])

  const pageCount = Math.ceil(showings.length / ITEMS_PER_PAGE) || 1
  const pagedShowings = useMemo(
    () => showings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [currentPage, showings],
  )

  return (
    <div className="space-y-4">
      <div className="md:hidden space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && pagedShowings.length === 0 && <p className="text-sm text-muted-foreground">No showings found.</p>}
        {pagedShowings.map((showing) => (
          <ShowingCard key={showing.id} showing={showing} onEdit={onEdit} onDelete={onDelete} onBuyerClick={onBuyerClick} />
        ))}
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && pagedShowings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>No showings found.</TableCell>
              </TableRow>
            )}
            {pagedShowings.map((showing) => {
              const buyerName = showing.buyers
                ? showing.buyers.full_name || `${showing.buyers.fname || ""} ${showing.buyers.lname || ""}`.trim()
                : ""
              const initials = showing.buyers
                ? `${showing.buyers.fname?.[0] || ""}${showing.buyers.lname?.[0] || ""}`.toUpperCase() || "?"
                : ""

              return (
                <TableRow key={showing.id}>
                  <TableCell className="text-sm font-medium">
                    {showing.scheduled_at ? format(parseISO(showing.scheduled_at), "MMM d, yyyy · h:mm a") : "—"}
                  </TableCell>
                  <TableCell>
                    {showing.buyers ? (
                      <button
                        type="button"
                        onClick={() => onBuyerClick(showing.buyers as Buyer)}
                        className="inline-flex items-center gap-2 hover:text-primary"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials}
                        </span>
                        <span className="text-sm font-medium">{buyerName || "Unnamed Buyer"}</span>
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {showing.properties ? (
                      <Link href={`/properties/edit/${showing.properties.id}`} className="text-blue-600 hover:underline">
                        {showing.properties.address}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ShowingStatusBadge status={showing.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{showing.notes || "—"}</TableCell>
                  <TableCell>
                    <Can permission="showings.manage">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <span className="sr-only">Actions</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(showing)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(showing)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage(Math.max(1, currentPage - 1))
                }}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: pageCount }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={currentPage === i + 1}
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(i + 1)
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage(Math.min(pageCount, currentPage + 1))
                }}
                className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
