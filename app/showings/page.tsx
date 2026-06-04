"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { Can } from "@/components/auth/Can"
import EditBuyerModal from "@/components/buyers/edit-buyer-modal"
import SendSmsModal from "@/components/buyers/send-sms-modal"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import EditShowingModal from "@/components/showings/edit-showing-modal"
import DeleteShowingModal from "@/components/showings/delete-showing-modal"
import ShowingsCalendarView from "@/components/showings/showings-calendar-view"
import ShowingsListView from "@/components/showings/showings-list-view"
import { ShowingService } from "@/services/showing-service"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"

const STATUSES = ["all", "scheduled", "completed", "canceled", "rescheduled"]

export default function ShowingsPage() {
  const { can, loading: permissionsLoading } = usePermissions()
  const queryClient = useQueryClient()
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
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [smsBuyer, setSmsBuyer] = useState<Buyer | null>(null)

  const { data: showings = [], isLoading, refetch } = useQuery({
    queryKey: ["showings", statusFilter, startDate, endDate],
    queryFn: () =>
      ShowingService.getShowings({
        status: statusFilter === "all" ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: !permissionsLoading && can("showings.view"),
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

  const handleText = (buyer: Buyer) => {
    setSmsBuyer(buyer)
    setShowSendSmsModal(true)
  }

  const handleCancelShowing = async (showing: ShowingWithRelations) => {
    try {
      await ShowingService.updateShowing(showing.id, { status: "canceled" })
      await queryClient.invalidateQueries({ queryKey: ["showings"] })
      toast.success("Showing canceled")
    } catch (err) {
      console.error("Error canceling showing:", err)
      toast.error("Failed to cancel showing")
    }
  }

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="p-4 text-sm text-muted-foreground">Checking showing permissions...</div>
      </MainLayout>
    )
  }

  if (!can("showings.view")) {
    return (
      <MainLayout>
        <div className="space-y-2 p-4">
          <h1 className="text-2xl font-bold tracking-tight">Showings</h1>
          <p className="text-sm text-muted-foreground">You do not have permission to view showings.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Showings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage property showings and appointments</p>
          </div>
          <Can permission="showings.manage">
            <Button variant="brand" onClick={() => setShowScheduleModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Schedule showing
            </Button>
          </Can>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <p className="text-xs">Upcoming</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-blue-600 dark:text-blue-400">{upcoming}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <p className="text-xs">Completed</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-emerald-600 dark:text-emerald-400">{completed}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" />
              <p className="text-xs">Cancelled</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-foreground">{cancelled}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              <p className="text-xs">Rescheduled</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-amber-600 dark:text-amber-400">{rescheduled}</p>
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="inline-flex h-auto gap-1 rounded-lg bg-muted p-1">
              <TabsTrigger value="calendar" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <List className="mr-2 h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-40">
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
                className="h-9 w-40"
                aria-label="Start date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-40"
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
              onText={handleText}
              onCancel={handleCancelShowing}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ShowingsListView
              showings={showings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBuyerClick={handleBuyerClick}
              onText={handleText}
              onCancel={handleCancelShowing}
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
        <SendSmsModal open={showSendSmsModal} onOpenChange={setShowSendSmsModal} buyer={smsBuyer} />
        <Can permission="showings.manage">
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
        </Can>
        <Can permission="showings.manage">
          <ScheduleShowingModal
            open={showScheduleModal}
            onOpenChange={setShowScheduleModal}
            onSuccess={refetch}
          />
        </Can>
      </div>
    </MainLayout>
  )
}
