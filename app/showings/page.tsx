"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar,
  CalendarIcon,
  CheckCircle2,
  List,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import EditBuyerModal from "@/components/buyers/edit-buyer-modal"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import EditShowingModal from "@/components/showings/edit-showing-modal"
import DeleteShowingModal from "@/components/showings/delete-showing-modal"
import ShowingsCalendarView from "@/components/showings/showings-calendar-view"
import ShowingsListView from "@/components/showings/showings-list-view"
import { ShowingService } from "@/services/showing-service"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"

const STATUSES = ["all", "scheduled", "completed", "canceled", "rescheduled"]

export default function ShowingsPage() {
  const params = useSearchParams()
  const defaultOpen = params.get("new") === "1"
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(defaultOpen)
  const [selectedShowing, setSelectedShowing] = useState<ShowingWithRelations | null>(null)
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

  const now = new Date().toISOString()
  const upcoming = showings.filter((s) => s.status === "scheduled" && (s.scheduled_at || "") >= now).length
  const completed = showings.filter((s) => s.status === "completed").length
  const cancelled = showings.filter((s) => s.status === "canceled").length
  const rescheduled = showings.filter((s) => s.status === "rescheduled").length

  const handleEdit = (showing: ShowingWithRelations) => {
    setSelectedShowing(showing)
    setShowEditShowing(true)
  }

  const handleDelete = (showing: ShowingWithRelations) => {
    setSelectedShowing(showing)
    setShowDeleteShowing(true)
  }

  const handleBuyerClick = (buyer: Buyer) => {
    setSelectedBuyer(buyer)
    setShowEditModal(true)
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Showings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage property showings and appointments</p>
          </div>
          <Button onClick={() => setShowScheduleModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Showing
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{upcoming}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Completed</p>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{completed}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Cancelled</p>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{cancelled}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Rescheduled</p>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{rescheduled}</p>
          </Card>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="calendar">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="mr-2 h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                aria-label="Start date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                aria-label="End date"
              />
            </div>
          </div>

          <TabsContent value="calendar" className="mt-4">
            <ShowingsCalendarView
              showings={showings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBuyerClick={handleBuyerClick}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ShowingsListView
              showings={showings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBuyerClick={handleBuyerClick}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>

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
