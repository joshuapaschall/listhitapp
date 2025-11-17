"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import EditBuyerModal from "@/components/buyers/edit-buyer-modal"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import EditShowingModal from "@/components/showings/edit-showing-modal"
import DeleteShowingModal from "@/components/showings/delete-showing-modal"
import { ShowingService } from "@/services/showing-service"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { Showing, Buyer } from "@/lib/supabase"

const STATUSES = ["all", "scheduled", "completed", "canceled"]
const ITEMS_PER_PAGE = 10

export default function ShowingsPage() {
  const params = useSearchParams()
  const defaultOpen = params.get("new") === "1"
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(defaultOpen)
  const [selectedShowing, setSelectedShowing] = useState<Showing | null>(null)
  const [showEditShowing, setShowEditShowing] = useState(false)
  const [showDeleteShowing, setShowDeleteShowing] = useState(false)

  const { data: showings = [], isLoading, refetch } = useQuery({
    queryKey: ["showings", statusFilter, startDate, endDate],
    queryFn: () =>
      ShowingService.getShowings({
        status: statusFilter === "all" ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  })

  const pageCount = Math.ceil(showings.length / ITEMS_PER_PAGE) || 1
  const paged = showings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const formatDate = (iso: string) => new Date(iso).toLocaleString()

  const displayName = (b: any) =>
    b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed Buyer"

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <h1 className="text-2xl font-bold">Showings</h1>
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
              <label htmlFor="start-date" className="block text-sm mb-1">From</label>
              <Input
                id="start-date"
                name="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setCurrentPage(1)
                  setStartDate(e.target.value)
                }}
                className="w-36"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm mb-1">To</label>
              <Input
                id="end-date"
                name="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setCurrentPage(1)
                  setEndDate(e.target.value)
                }}
                className="w-36"
              />
            </div>
            <Button onClick={() => setShowScheduleModal(true)} className="ml-auto">
              Schedule Showing
            </Button>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
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
                  <TableCell colSpan={5}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No showings found.</TableCell>
                </TableRow>
              )}
              {paged.map((showing: any) => (
                <TableRow key={showing.id}>
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    {formatDate(showing.scheduled_at)}
                  </TableCell>
                  <TableCell>
                    {showing.buyers ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => {
                          setSelectedBuyer(showing.buyers)
                          setShowEditModal(true)
                        }}
                      >
                        {displayName(showing.buyers)}
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {showing.properties ? (
                      <Link
                        href={`/properties/edit/${showing.properties.id}`}
                        className="text-blue-600 underline"
                      >
                        {showing.properties.address}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{showing.status}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {showing.notes || "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Actions</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedShowing(showing)
                            setShowEditShowing(true)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedShowing(showing)
                            setShowDeleteShowing(true)
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
        <EditBuyerModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          buyer={selectedBuyer}
          onSuccess={refetch}
        />
        <EditShowingModal
          open={showEditShowing}
          onOpenChange={setShowEditShowing}
          showing={selectedShowing}
          onSuccess={refetch}
        />
        <DeleteShowingModal
          open={showDeleteShowing}
          onOpenChange={setShowDeleteShowing}
          showing={selectedShowing}
          onSuccess={refetch}
        />
        <ScheduleShowingModal
          open={showScheduleModal}
          onOpenChange={setShowScheduleModal}
          onSuccess={refetch}
        />
      </div>
    </MainLayout>
  )
}
