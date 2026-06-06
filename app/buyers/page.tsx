"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { formatPhoneDisplay } from "@/lib/dedup-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import type { Buyer, Tag } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { filterStateToDefinition } from "@/lib/segments/filter-mapping"
import { applyAttributeConditions } from "@/lib/segments/apply-filters"
import type { AttributeCondition } from "@/lib/segments/types"
import { BuyerService } from "@/services/buyer-service"
import { toast } from "sonner"
import ImportBuyersModal from "@/components/buyers/import-buyers-modal"
import AddBuyerModal from "@/components/buyers/add-buyer-modal"
import EditBuyerModal from "@/components/buyers/edit-buyer-modal"
import SendSmsModal from "@/components/buyers/send-sms-modal"
import SendEmailModal from "@/components/buyers/send-email-modal"
import SmartGroupsSidebar from "@/components/buyers/smart-groups-sidebar"
import BulkTagsDialog from "@/components/buyers/bulk-tags-dialog"
import BulkGroupDialog from "@/components/buyers/bulk-group-dialog"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import {
  addBuyersToGroups,
  removeBuyersFromGroups,
  replaceGroupsForBuyers,
  clearAllGroupsForBuyers,
} from "@/lib/group-service"
import { bulkUpdateBuyerTags, getBuyerTagCounts, type BuyerTagCount } from "@/lib/tag-service"
import MainLayout from "@/components/layout/main-layout"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Search,
  Star,
  Mail,
  MessageSquare,
  MoreHorizontal,
  CheckCircle,
  X,
  Loader2,
  PanelLeftClose, PanelLeftOpen,
  Users,
  Tags,
  UserPlus,
  UserMinus,
  UserX,
  Trash2,
  Target,
  Download,
  ChevronLeft,
  ChevronRight,
  Menu,
  Pencil,
  Ban,
} from "lucide-react"

import TagFilterSelector from "@/components/buyers/tag-filter-selector"
import { CallButton } from "@/components/voice/CallButton"
import LocationFilterSelector from "@/components/buyers/location-filter-selector"
import { exportBuyersToCSV } from "@/lib/export-utils"
import { Can } from "@/components/auth/Can"
import { usePermissions } from "@/hooks/use-permissions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PROPERTY_TYPES } from "@/lib/constant"
import { saveAudienceSnapshot } from "@/lib/campaign-audience"
import CampaignChannelPicker from "@/components/campaigns/campaign-channel-picker"

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_ITEMS_PER_PAGE = 50
const log = createLogger("page")

interface FilterState {
  search: string
  selectedTags: string[]
  excludeTags: string[]
  selectedLocations: string[]
  minScore: string
  maxScore: string
  vip: string
  vetted: string
  canReceiveEmail: string
  canReceiveSMS: string
  createdAfter: string
  createdBefore: string
  propertyType: string
}

const applyBuyerFilterPredicates = (query: any, filters: FilterState) => {
  if (filters.search) {
    const encoded = encodeURIComponent(filters.search)
    query = query.or(
      `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
    )
  }
  const { conditions } = filterStateToDefinition(filters).definition
  query = applyAttributeConditions(query, conditions as AttributeCondition[])
  if (filters.canReceiveEmail === "yes") {
    query = query.eq("can_receive_email", true).not("email_norm", "is", null)
  } else if (filters.canReceiveEmail === "no") {
    query = query.eq("can_receive_email", false)
  }
  if (filters.canReceiveSMS === "yes") {
    query = query.eq("can_receive_sms", true).not("phone_norm", "is", null)
  } else if (filters.canReceiveSMS === "no") {
    query = query.eq("can_receive_sms", false)
  }
  return query
}

const applyEmailEligibility = (query: any) =>
  query
    .not("email_norm", "is", null)
    .not("can_receive_email", "is", false)
    .not("email_suppressed", "is", true)
    .not("is_unsubscribed", "is", true)
    .is("blocked_at", null)

const applySmsEligibility = (query: any) =>
  query
    .not("phone_norm", "is", null)
    .not("can_receive_sms", "is", false)
    .not("sms_suppressed", "is", true)
    .is("blocked_at", null)

const fetchChannelCounts = async (filters: FilterState, groupId?: string) => {
  const base = () => {
    let q: any = supabase.from("buyers")
    if (groupId) {
      q = q
        .select("id, buyer_groups!inner(group_id)", { count: "exact", head: true })
        .eq("buyer_groups.group_id", groupId)
    } else {
      q = q.select("id", { count: "exact", head: true })
    }
    q = q.is("deleted_at", null)
    return applyBuyerFilterPredicates(q, filters)
  }
  const [emailRes, smsRes] = await Promise.all([
    applyEmailEligibility(base()),
    applySmsEligibility(base()),
  ])
  return { emailable: emailRes.count || 0, textable: smsRes.count || 0 }
}

// Server-side filtering and pagination
const fetchBuyers = async (
  page: number,
  filters: FilterState,
  groupId?: string,
  perPage = DEFAULT_ITEMS_PER_PAGE,
) => {
  log("fetchBuyers", "Fetching buyers for page:", page, "with filters:", filters)

  let query: any = supabase.from("buyers")

  if (groupId) {
    query = query
      .select("*, buyer_groups!inner(group_id)", { count: "exact" })
      .eq("buyer_groups.group_id", groupId)
  } else {
    query = query.select("*", { count: "exact" })
  }

  query = query
    .is("deleted_at", null)
    .range((page - 1) * perPage, page * perPage - 1)
    .order("created_at", { ascending: false })

  query = applyBuyerFilterPredicates(query, filters)

  log("fetchBuyers", "Executing database query...")
  const { data, error, count } = await query

  if (error) {
    log("error", "Failed to fetch buyers", { error })
    throw error
  }

  log("fetchBuyers", "Fetched buyers:", data?.length, "Total count:", count)

  const buyersOnly = (data || []).map((row: any) => {
    const { buyer_groups, ...rest } = row
    return rest
  })

  return {
    buyers: buyersOnly,
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
  }
}

const fetchTags = async (): Promise<Tag[]> => {
  log("fetchTags", "Fetching tags...")

  const { data, error } = await supabase.from("tags").select("*").order("name")
  if (error) {
    log("error", "Failed to fetch tags", { error })
    throw error
  }
  log("fetchTags", "Fetched tags:", data?.length)
  return data || []
}

// Fetch all buyer IDs matching current filters
const fetchBuyerIds = async (
  filters: FilterState,
  groupId?: string,
  channel?: "email" | "sms",
) => {
  let query: any = supabase.from("buyers")

  if (groupId) {
    query = query
      .select("id,buyer_groups!inner(group_id)")
      .eq("buyer_groups.group_id", groupId)
  } else {
    query = query.select("id")
  }

  query = query.is("deleted_at", null)
  query = applyBuyerFilterPredicates(query, filters)

  if (channel === "email") query = applyEmailEligibility(query)
  else if (channel === "sms") query = applySmsEligibility(query)

  const { data, error } = await query

  if (error) {
    log("error", "Failed to fetch buyer ids", { error })
    throw error
  }

  return (data || []).map((row: any) => row.id) as string[]
}

function BuyersPageContent() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const suppressBuyerModalAutoOpenRef = useRef(false)
  const { loading: permissionsLoading, can, isAdmin } = usePermissions()

  // UI state
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [showEditBuyerModal, setShowEditBuyerModal] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null)
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [smsBuyer, setSmsBuyer] = useState<Buyer | null>(null)
  const [showSendEmailModal, setShowSendEmailModal] = useState(false)
  const [emailBuyer, setEmailBuyer] = useState<Buyer | null>(null)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignPickerSource, setCampaignPickerSource] = useState<"header" | "selection">("header")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [groupsCollapsed, setGroupsCollapsed] = useState(false)

  // Persist the Smart Groups collapsed state (mirrors the main Sidebar pattern).
  useEffect(() => {
    const stored = localStorage.getItem("listhit.buyers.groupsCollapsed")
    if (stored !== null) setGroupsCollapsed(stored === "true")
  }, [])

  useEffect(() => {
    localStorage.setItem("listhit.buyers.groupsCollapsed", String(groupsCollapsed))
  }, [groupsCollapsed])
  const [tagActionMode, setTagActionMode] = useState<"add" | "remove">("add")
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [removeTagOptions, setRemoveTagOptions] = useState<BuyerTagCount[]>([])
  const [removeTagsLoading, setRemoveTagsLoading] = useState(false)
  const [groupActionMode, setGroupActionMode] = useState<
    "add" | "remove" | "move"
  >("add")
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [buyerToDelete, setBuyerToDelete] = useState<Buyer | null>(null)

  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Active filters state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    selectedTags: [],
    excludeTags: [],
    selectedLocations: [],
    minScore: "",
    maxScore: "",
    vip: "any",
    vetted: "any",
    canReceiveEmail: "any",
    canReceiveSMS: "any",
    createdAfter: "",
    createdBefore: "",
    propertyType: "any",
  })

  const debouncedSearch = useDebounce(filters.search)
  const canViewBuyers = isAdmin || can("buyers.view")

  const filtersActive = Boolean(
    filters.search ||
      filters.selectedTags?.length ||
      filters.excludeTags?.length ||
      filters.selectedLocations?.length ||
      filters.minScore ||
      filters.maxScore ||
      filters.vip !== "any" ||
      filters.vetted !== "any" ||
      filters.canReceiveEmail !== "any" ||
      filters.canReceiveSMS !== "any" ||
      filters.createdAfter ||
      filters.createdBefore ||
      (filters.propertyType && filters.propertyType !== "any")
  )

  // React Query for buyers with caching
  const {
    data: buyersData,
    isLoading: buyersLoading,
    error: buyersError,
    isError: isBuyersError,
  } = useQuery({
    queryKey: [
      "buyers",
      currentPage,
      itemsPerPage,
      { ...filters, search: debouncedSearch },
      selectedGroupId,
    ],
    queryFn: () =>
      fetchBuyers(
        currentPage,
        { ...filters, search: debouncedSearch },
        selectedGroupId,
        itemsPerPage,
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
    placeholderData: keepPreviousData,
    enabled: !permissionsLoading && canViewBuyers,
  })

  // React Query for tags with caching
  const {
    data: tags = [],
    isLoading: tagsLoading,
    error: tagsError,
    isError: isTagsError,
  } = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    retryDelay: 1000,
    enabled: !permissionsLoading && canViewBuyers,
  })

  // React Query for buyer counts by group
  const { data: buyerCounts = {}, isLoading: countsLoading } = useQuery({
    queryKey: ["buyerCountsByGroup"],
    queryFn: BuyerService.getBuyerCountsByGroup,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !permissionsLoading && canViewBuyers,
  })

  // React Query for total buyer count
  const { data: totalBuyersCount = 0, isLoading: totalCountLoading } = useQuery({
    queryKey: ["totalBuyersCount"],
    queryFn: BuyerService.getTotalBuyerCount,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !permissionsLoading && canViewBuyers,
  })

  const { data: channelCounts = { emailable: 0, textable: 0 } } = useQuery({
    queryKey: [
      "channelCounts",
      { ...filters, search: debouncedSearch },
      selectedGroupId,
    ],
    queryFn: () =>
      fetchChannelCounts({ ...filters, search: debouncedSearch }, selectedGroupId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: !permissionsLoading && canViewBuyers && filtersActive,
  })

  const buyers = useMemo(() => buyersData?.buyers || [], [buyersData])
  const totalPages = buyersData?.totalPages || 1
  const totalCount = buyersData?.totalCount || 0

  useEffect(() => {
    const buyerId = searchParams.get("buyerId")
    if (!buyerId) {
      suppressBuyerModalAutoOpenRef.current = false
      return
    }
    if (suppressBuyerModalAutoOpenRef.current) return
    if (editingBuyer?.id === buyerId && showEditBuyerModal) return
    const existingBuyer = buyers.find((buyer: Buyer) => buyer.id === buyerId)
    if (existingBuyer) {
      setEditingBuyer(existingBuyer)
      setShowEditBuyerModal(true)
      return
    }

    let isActive = true
    supabase
      .from("buyers")
      .select("*")
      .eq("id", buyerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isActive) return
        if (error) {
          log("error", "Failed to fetch buyer for deep link", { buyerId, error })
          return
        }
        if (data) {
          setEditingBuyer(data as Buyer)
          setShowEditBuyerModal(true)
        }
      })
    return () => {
      isActive = false
    }
  }, [buyers, editingBuyer?.id, searchParams, showEditBuyerModal])

  const loading =
    permissionsLoading || (buyersLoading && !buyersData) || tagsLoading || countsLoading || totalCountLoading
  const error = buyersError || tagsError
  const isError = isBuyersError || isTagsError

  // Debug logging
  useEffect(() => {
    log("state", "Component update", {
      loading,
      error: error?.message,
      isError,
      buyersCount: buyers.length,
      totalCount,
      totalBuyersCount,
      buyersLoading,
      tagsLoading,
      countsLoading,
    })
  }, [
    loading,
    error,
    isError,
    buyers.length,
    totalCount,
    buyersLoading,
    tagsLoading,
    countsLoading,
    totalCountLoading,
    totalBuyersCount,
  ])

  // Preload next page for better UX
  useEffect(() => {
    if (!canViewBuyers) return
    if (currentPage < totalPages) {
      queryClient.prefetchQuery({
        queryKey: [
          "buyers",
          currentPage + 1,
          itemsPerPage,
          { ...filters, search: debouncedSearch },
          selectedGroupId,
        ],
        queryFn: () =>
          fetchBuyers(
            currentPage + 1,
            { ...filters, search: debouncedSearch },
            selectedGroupId,
            itemsPerPage,
          ),
        staleTime: 5 * 60 * 1000,
      })
    }
  }, [
    currentPage,
    totalPages,
    filters,
    debouncedSearch,
    selectedGroupId,
    queryClient,
    itemsPerPage,
    canViewBuyers,
  ])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    debouncedSearch,
    filters.selectedTags,
    filters.excludeTags,
    filters.selectedLocations,
    filters.minScore,
    filters.maxScore,
    filters.vip,
    filters.vetted,
    filters.canReceiveEmail,
    filters.canReceiveSMS,
    filters.createdAfter,
    filters.createdBefore,
    filters.propertyType,
    selectedGroupId,
    itemsPerPage,
  ])

  // Export functions - only for selected buyers
  const handleExportCSV = async () => {
    if (selectedBuyers.length === 0) {
      log("warn", "Export CSV attempted with no selection")
      toast.error("Please select buyers to export")
      return
    }

    try {
      const response = await fetch("/api/buyers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { ...filters, search: debouncedSearch },
          groupId: selectedGroupId || undefined,
          buyerIds: allSelected ? undefined : selectedBuyers,
        }),
      })

      if (response.status === 403) {
        toast.error("You don't have permission to export buyers.")
        return
      }

      if (!response.ok) {
        throw new Error("export failed")
      }

      const { buyers: selectedBuyerData = [] } = await response.json()
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `buyers-export-${timestamp}.csv`
      exportBuyersToCSV(selectedBuyerData, filename)
      toast.success("Export started")
    } catch (err) {
      log("error", "Failed to export buyers", { error: err })
      toast.error("Failed to export buyers")
    }
  }

  // Bulk actions
  const handleBulkAddTags = async (tagsToAdd: string[]) => {
    try {
      await bulkUpdateBuyerTags(selectedBuyers, { add: tagsToAdd })
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Tags added")
    } catch (err) {
      log("error", "Failed to add tags", { error: err })
      toast.error("Failed to add tags")
    }
  }

  const handleBulkRemoveTags = async (tagsToRemove: string[]) => {
    try {
      await bulkUpdateBuyerTags(selectedBuyers, { remove: tagsToRemove })
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Tags removed")
    } catch (err) {
      log("error", "Failed to remove tags", { error: err })
      toast.error("Failed to remove tags")
    }
  }

  const handleBulkAddToGroup = async (groupIds: string[]) => {
    try {
      await addBuyersToGroups(selectedBuyers, groupIds)
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Added to groups")
    } catch (err) {
      log("error", "Failed to add to group", { error: err })
      toast.error("Failed to add to group")
    }
  }

  const handleBulkRemoveFromGroup = async (groupIds: string[]) => {
    try {
      await removeBuyersFromGroups(selectedBuyers, groupIds)
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Removed from groups")
    } catch (err) {
      log("error", "Failed to remove from group", { error: err })
      toast.error("Failed to remove from group")
    }
  }

  const handleBulkMoveToGroup = async (groupIds: string[]) => {
    try {
      await replaceGroupsForBuyers(selectedBuyers, groupIds)
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Moved to groups")
    } catch (err) {
      log("error", "Failed to move to group", { error: err })
      toast.error("Failed to move to group")
    }
  }

  const handleBulkClearGroups = async () => {
    try {
      await clearAllGroupsForBuyers(selectedBuyers)
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Removed from all groups")
    } catch (err) {
      log("error", "Failed to remove from all groups", { error: err })
      toast.error("Failed to remove from all groups")
    }
  }

  const performBulkDelete = async () => {
    try {
      const res = await fetch("/api/buyers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedBuyers }),
      })
      if (!res.ok) throw new Error("bulk delete failed")
      const json = await res.json().catch(() => ({}))
      if (typeof json.deleted === "number" && json.deleted === 0) {
        throw new Error("no buyers were deleted")
      }
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      setSelectedBuyers([])
      toast.success("Buyers deleted")
    } catch (err) {
      log("error", "Failed to delete buyers", { error: err })
      toast.error("Failed to delete buyers")
    } finally {
      setShowBulkDeleteDialog(false)
    }
  }

  const handleEditBuyer = (buyer: Buyer) => {
    setEditingBuyer(buyer)
    setShowEditBuyerModal(true)
  }

  const handleEditBuyerModalChange = (open: boolean) => {
    if (!open) {
      setEditingBuyer(null)
      const params = new URLSearchParams(searchParams.toString())
      if (params.has("buyerId")) {
        suppressBuyerModalAutoOpenRef.current = true
        params.delete("buyerId")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
      }
    }
    setShowEditBuyerModal(open)
  }

  const handleSendSms = (buyer: Buyer) => {
    setSmsBuyer(buyer)
    setShowSendSmsModal(true)
  }

  const handleSendEmail = (buyer: Buyer) => {
    setEmailBuyer(buyer)
    setShowSendEmailModal(true)
  }

  const handleToggleBlock = async (buyer: Buyer) => {
    const action = buyer.blocked_at ? "unblock" : "block"
    try {
      const res = await fetch(`/api/buyers/${buyer.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("block request failed")
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      toast.success(action === "block" ? "Buyer blocked" : "Buyer unblocked")
    } catch (err) {
      log("error", "Failed to toggle block", { error: err })
      toast.error(action === "block" ? "Failed to block buyer" : "Failed to unblock buyer")
    }
  }

  const performDeleteBuyer = async () => {
    if (!buyerToDelete) return
    try {
      const res = await fetch(`/api/buyers/${buyerToDelete.id}/delete`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("delete failed")
      const json = await res.json().catch(() => ({}))
      if (typeof json.deleted === "number" && json.deleted === 0) {
        throw new Error("no buyers were deleted")
      }
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
      toast.success("Buyer deleted")
    } catch (err) {
      log("error", "Failed to delete buyer", { error: err })
      toast.error("Failed to delete buyer")
    } finally {
      setBuyerToDelete(null)
    }
  }

  const handleSelectAllResults = async () => {
    const ids = await fetchBuyerIds(
      { ...filters, search: debouncedSearch },
      selectedGroupId,
    )
    setSelectedBuyers(ids)
    setAllSelected(true)
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedBuyers([])
      setAllSelected(false)
    } else {
      setSelectedBuyers(buyers.map((buyer: Buyer) => buyer.id))
      setAllSelected(buyers.length === totalCount)
    }
  }

  const toggleSelectBuyer = (id: string) => {
    if (selectedBuyers.includes(id)) {
      setSelectedBuyers(selectedBuyers.filter((buyerId: string) => buyerId !== id))
      setAllSelected(false)
    } else {
      setSelectedBuyers([...selectedBuyers, id])
      if (selectedBuyers.length + 1 === totalCount) {
        setAllSelected(true)
      }
    }
  }

  const clearAllFilters = () => {
    setFilters({
      search: "",
      selectedTags: [],
      excludeTags: [],
      selectedLocations: [],
      minScore: "",
      maxScore: "",
      vip: "any",
      vetted: "any",
      canReceiveEmail: "any",
      canReceiveSMS: "any",
      createdAfter: "",
      createdBefore: "",
      propertyType: "any",
    })
    setSelectedGroupId("")
  }

  const handleCreateCampaignForFilteredBuyers = async (channel: "email" | "sms") => {
    const ids = await fetchBuyerIds(
      { ...filters, search: debouncedSearch },
      selectedGroupId,
      channel,
    )
    saveAudienceSnapshot({
      createdAt: new Date().toISOString(),
      source: "buyers-filter",
      channel,
      search: filters.search,
      selectedTags: filters.selectedTags,
      excludeTags: filters.excludeTags,
      selectedLocations: filters.selectedLocations,
      minScore: filters.minScore,
      maxScore: filters.maxScore,
      vip: filters.vip,
      vetted: filters.vetted,
      canReceiveEmail: filters.canReceiveEmail,
      canReceiveSMS: filters.canReceiveSMS,
      createdAfter: filters.createdAfter,
      createdBefore: filters.createdBefore,
      propertyType: filters.propertyType,
      buyerIds: ids,
      recipientCount: ids.length,
    })
    router.push(`/campaigns?prefill=${channel}`)
  }

  // Save-as-segment door: maps the CURRENT filter to a reusable segment.
  const [saveSegmentOpen, setSaveSegmentOpen] = useState(false)
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const [savingSegment, setSavingSegment] = useState(false)
  const filterMapping = useMemo(() => filterStateToDefinition(filters as any), [filters])

  const handleSaveAsSegment = async () => {
    if (!segmentName.trim()) return
    setSavingSegment(true)
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: segmentName.trim(),
          description: segmentDescription.trim() || undefined,
          definition: filterMapping.definition,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to save segment")
      }
      toast.success("Saved to your library", {
        action: { label: "View segments", onClick: () => router.push("/settings/segments") },
      })
      setSaveSegmentOpen(false)
      setSegmentName("")
      setSegmentDescription("")
    } catch (e: any) {
      toast.error(e?.message || "Failed to save segment")
    } finally {
      setSavingSegment(false)
    }
  }

  const formatName = (buyer: Buyer) => {
    if (buyer.full_name) return buyer.full_name
    if (buyer.fname && buyer.lname) return `${buyer.fname} ${buyer.lname}`
    if (buyer.fname) return buyer.fname
    if (buyer.lname) return buyer.lname
    return "No Name"
  }


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your buyers...</p>
          <p className="text-sm text-muted-foreground mt-2">
            {buyersLoading && "Fetching buyers data..."}
            {tagsLoading && "Fetching tags data..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Check browser console for detailed logs</p>
        </div>
      </div>
    )
  }


  if (!canViewBuyers) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <Users className="h-12 w-12 text-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">You don&apos;t have access to Buyers</h2>
          <p className="text-sm text-muted-foreground">
            Ask an administrator to grant buyers.view before you can view buyer records.
          </p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">Failed to load data</p>
          <p className="text-sm text-muted-foreground mb-4">Error: {error?.message || "Unknown error occurred"}</p>
          <div className="space-y-2">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["buyers"] })}>Try Again</Button>
            <p className="text-xs text-muted-foreground">Check browser console for detailed error logs</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-background overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Smart Groups Sidebar - Responsive width */}
      <div
        className={`
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0 fixed xl:static inset-y-0 left-0 z-50
        w-[15rem] border-r bg-background transition-all duration-300 ease-in-out shrink-0
        ${groupsCollapsed ? "xl:w-0 xl:overflow-hidden xl:border-0 xl:opacity-0 xl:p-0" : "xl:w-64"}
      `}
      >
        <SmartGroupsSidebar
          onGroupSelect={setSelectedGroupId}
          selectedGroupId={selectedGroupId}
          buyerCounts={buyerCounts}
          totalBuyers={totalBuyersCount}
          filteredBuyers={totalCount}
        />
      </div>

      {/* Main Content - Better responsive layout */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header - More compact on smaller screens */}
        <div className="border-b bg-background">
          <div className="p-3 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-4 mb-4 lg:mb-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 mr-2"
                  aria-label="Open sidebar menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGroupsCollapsed((v) => !v)}
                  className="hidden xl:inline-flex p-2 mr-1"
                  aria-label="Toggle smart groups"
                >
                  {groupsCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
                <h1 className="text-xl lg:text-2xl font-bold">👥 Buyers</h1>
                <Badge variant="secondary" className="text-sm">
                  {totalCount} results
                </Badge>
                {filtersActive && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="brand"
                        size="sm"
                        className="h-9"
                        disabled={channelCounts.emailable === 0}
                        title={channelCounts.emailable === 0 ? "No buyers in this filter have a valid email" : undefined}
                        onClick={() => handleCreateCampaignForFilteredBuyers("email")}
                      >
                        <Mail className="h-4 w-4" />
                        Email these {channelCounts.emailable.toLocaleString()}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={channelCounts.textable === 0}
                        title={channelCounts.textable === 0 ? "No buyers in this filter have a textable number" : undefined}
                        onClick={() => handleCreateCampaignForFilteredBuyers("sms")}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Text these {channelCounts.textable.toLocaleString()}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setSaveSegmentOpen(true)}
                        aria-label="Save current filter as a reusable segment"
                      >
                        Save as segment
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Of {totalCount.toLocaleString()} matched · {channelCounts.emailable.toLocaleString()} have a valid email · {channelCounts.textable.toLocaleString()} textable (opt-outs &amp; DNC excluded)
                    </p>
                  </div>
                )}
                {totalCount > itemsPerPage && (
                  <Badge variant="outline" className="text-sm hidden sm:inline-flex">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Can permission="buyers.edit">
                  <Button
                    className="btn-primary"
                    onClick={() => setShowAddBuyerModal(true)}
                    aria-label="Add a new buyer manually"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add Buyer
                  </Button>
                </Can>
                <Can permission="buyers.import">
                  <ImportBuyersModal
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["buyers"] })
                    queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
                    queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
                  }}
                  />
                </Can>
                <Can permission="buyers.export">
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="btn-ghost"
                      disabled={selectedBuyers.length === 0}
                      aria-label={
                        selectedBuyers.length === 0
                          ? "Select buyers to export"
                          : `Export ${selectedBuyers.length} selected buyers`
                      }
                    >
                      <Download className="mr-1 h-4 w-4" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      Export as CSV ({selectedBuyers.length} buyers)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                </Can>
              </div>
            </div>

            {/* Enhanced Bulk Actions - More compact */}
              {selectedBuyers.length > 0 && (
              <div className="bg-muted border border-border rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{selectedBuyers.length} selected</span>
                {allSelected ? (
                  <button className="text-xs text-brand underline" onClick={() => setSelectedBuyers([])}>
                    All {totalCount} selected · Clear
                  </button>
                ) : totalCount > itemsPerPage && buyers.length > 0 && buyers.every((b: Buyer) => selectedBuyers.includes(b.id)) ? (
                  <button className="text-xs text-brand underline" onClick={handleSelectAllResults}>
                    Select all {totalCount} matching this filter
                  </button>
                ) : null}
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" aria-label="Manage tags for selected buyers">
                          <Tags className="mr-1 h-4 w-4" /> Tags
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setTagActionMode("add")
                            setShowTagDialog(true)
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add tags…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setTagActionMode("remove")
                            setRemoveTagOptions([])
                            setRemoveTagsLoading(true)
                            setShowTagDialog(true)
                            getBuyerTagCounts(selectedBuyers)
                              .then(setRemoveTagOptions)
                              .catch(() => toast.error("Couldn't load tags for this selection"))
                              .finally(() => setRemoveTagsLoading(false))
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove specific tags…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" aria-label="Manage groups for selected buyers">
                          <Users className="mr-1 h-4 w-4" /> Groups
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setGroupActionMode("add")
                            setShowGroupDialog(true)
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add to Group
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setGroupActionMode("remove")
                            setShowGroupDialog(true)
                          }}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove from a group…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setGroupActionMode("move")
                            setShowGroupDialog(true)
                          }}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Move to Group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBulkClearGroups}>
                          <UserX className="mr-2 h-4 w-4" />
                          Remove from all groups
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="brand" size="sm" aria-label="Create campaign with selected buyers" onClick={() => { setCampaignPickerSource("selection"); setCampaignPickerOpen(true) }}>
                      <Target className="mr-1 h-4 w-4" /> Campaign
                    </Button>

                    <Can permission="buyers.delete">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        aria-label="Delete selected buyers"
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </Can>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBuyers([])}
                      aria-label="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
            )}

            {/* Filters - More responsive grid */}
            <div className="space-y-3">
              {/* Row A — search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Search by name, phone, email, or company"
                  className="pl-9 h-9"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </div>

              {/* Row B — Location / Include / Exclude / Property Type on one row */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <LocationFilterSelector
                    selectedLocations={filters.selectedLocations || []}
                    onChange={(selectedLocations: string[]) => setFilters((prev) => ({ ...prev, selectedLocations }))}
                    placeholder="Locations…"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <TagFilterSelector
                    availableTags={tags}
                    selectedTags={filters.selectedTags || []}
                    onChange={(selectedTags: string[]) => setFilters((prev) => ({ ...prev, selectedTags }))}
                    placeholder="Include tags…"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <TagFilterSelector
                    availableTags={tags}
                    selectedTags={filters.excludeTags || []}
                    onChange={(excludeTags: string[]) => setFilters((prev) => ({ ...prev, excludeTags }))}
                    placeholder="Exclude tags…"
                    variant="exclude"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Select
                    value={filters.propertyType}
                    onValueChange={(value: string) => setFilters((prev) => ({ ...prev, propertyType: value }))}
                  >
                    <SelectTrigger id="property-type-filter" className="h-9">
                      <SelectValue placeholder="Any property type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any property type</SelectItem>
                      {PROPERTY_TYPES.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row C — Advanced filters toggle + Reset all */}
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground group-hover:text-foreground">Advanced filters</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAllFilters(); }}
                    className="text-brand hover:underline"
                    aria-label="Clear all active filters"
                  >
                    Reset all
                  </span>
                </summary>
                <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label htmlFor="min-score" className="block text-xs font-medium text-muted-foreground mb-1">Min Score</label>
                      <Input id="min-score" type="number" placeholder="0" min="0" max="100" className="h-9" value={filters.minScore} onChange={(e) => setFilters((prev) => ({ ...prev, minScore: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="max-score" className="block text-xs font-medium text-muted-foreground mb-1">Max Score</label>
                      <Input id="max-score" type="number" placeholder="100" min="0" max="100" className="h-9" value={filters.maxScore} onChange={(e) => setFilters((prev) => ({ ...prev, maxScore: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="created-after" className="block text-xs font-medium text-muted-foreground mb-1">Created After</label>
                      <Input id="created-after" type="date" className="h-9" value={filters.createdAfter} onChange={(e) => setFilters((prev) => ({ ...prev, createdAfter: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="created-before" className="block text-xs font-medium text-muted-foreground mb-1">Created Before</label>
                      <Input id="created-before" type="date" className="h-9" value={filters.createdBefore} onChange={(e) => setFilters((prev) => ({ ...prev, createdBefore: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="vip-status" className="block text-xs font-medium text-muted-foreground mb-1">VIP Status</label>
                      <Select value={filters.vip} onValueChange={(value: string) => setFilters((prev) => ({ ...prev, vip: value }))}>
                        <SelectTrigger id="vip-status" className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="vip">VIP Only</SelectItem>
                          <SelectItem value="not-vip">Non-VIP Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="vetted-status" className="block text-xs font-medium text-muted-foreground mb-1">Vetted Status</label>
                      <Select value={filters.vetted} onValueChange={(value: string) => setFilters((prev) => ({ ...prev, vetted: value }))}>
                        <SelectTrigger id="vetted-status" className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="vetted">Vetted Only</SelectItem>
                          <SelectItem value="not-vetted">Non-Vetted Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="email-status" className="block text-xs font-medium text-muted-foreground mb-1">Can Receive Email</label>
                      <Select value={filters.canReceiveEmail} onValueChange={(value: string) => setFilters((prev) => ({ ...prev, canReceiveEmail: value }))}>
                        <SelectTrigger id="email-status" className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="sms-status" className="block text-xs font-medium text-muted-foreground mb-1">Can Receive SMS</label>
                      <Select value={filters.canReceiveSMS} onValueChange={(value: string) => setFilters((prev) => ({ ...prev, canReceiveSMS: value }))}>
                        <SelectTrigger id="sms-status" className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Table — CSS grid, no horizontal scroll */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="min-w-0">
            {/* Header row */}
            <div
              className="grid items-center gap-2 sticky top-0 z-10 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: "34px minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) 72px 132px" }}
            >
              <div>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all buyers on this page"
                />
              </div>
              <div>Name</div>
              <div>Tags</div>
              <div>Locations</div>
              <div>Property types</div>
              <div>Created</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            {buyers.map((buyer: Buyer) => {
              const initials = formatName(buyer)
                .split(" ")
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase()
              const tagList = buyer.tags ?? []
              return (
                <div
                  key={buyer.id}
                  className={`grid items-center gap-2 border-b border-border px-3 py-2 hover:bg-muted/40 ${selectedBuyers.includes(buyer.id) ? "bg-brand/5" : ""}`}
                  style={{ gridTemplateColumns: "34px minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) 72px 132px" }}
                >
                  <div>
                    <Checkbox
                      checked={selectedBuyers.includes(buyer.id)}
                      onCheckedChange={() => toggleSelectBuyer(buyer.id)}
                      aria-label={`Select ${formatName(buyer)}`}
                    />
                  </div>

                  {/* Identity (bundled) */}
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>{initials || "—"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const name = formatName(buyer)
                          const noName = name === "No Name"
                          return (
                            <span className={`truncate text-sm font-medium ${noName ? "text-muted-foreground italic" : "text-foreground"}`}>
                              {name}
                            </span>
                          )
                        })()}
                        {buyer.vip && (
                          <span title="VIP Client"><Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" /></span>
                        )}
                        {buyer.vetted && (
                          <span title="Vetted Buyer"><CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /></span>
                        )}
                        {buyer.blocked_at && (
                          <span title="Blocked"><Ban className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" /></span>
                        )}
                        {buyer.email && (
                          <span title={buyer.can_receive_email && !buyer.is_unsubscribed ? "Can receive email" : "Cannot receive email"}>
                            <Mail className={`h-3.5 w-3.5 shrink-0 ${buyer.can_receive_email && !buyer.is_unsubscribed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"}`} />
                          </span>
                        )}
                        {buyer.phone && (
                          <span title={buyer.can_receive_sms && !buyer.is_unsubscribed ? "Can receive SMS" : "Cannot receive SMS"}>
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${buyer.can_receive_sms && !buyer.is_unsubscribed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"}`} />
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{buyer.phone ? formatPhoneDisplay(buyer.phone) : "No phone"}</span>
                        {" · "}
                        {buyer.email || "No email"}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {tagList.slice(0, 2).map((tag: string, index: number) => (
                      <span key={index} title={tag} className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {tagList.length > 2 && (
                      <span title={`${tagList.length - 2} more tags`} className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        +{tagList.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {(() => {
                      const locations = buyer.locations ?? []
                      if (locations.length === 0) {
                        return <span className="text-xs text-muted-foreground">—</span>
                      }
                      // Statewide-Georgia backfilled contacts carry every GA city; show a
                      // single chip instead of an unreadable wall of cities.
                      if (locations.length > 100) {
                        return (
                          <span className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Georgia · statewide
                          </span>
                        )
                      }
                      return (
                        <>
                          {locations.slice(0, 3).map((location: string, index: number) => (
                            <span key={index} title={location} className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {location}
                            </span>
                          ))}
                          {locations.length > 3 && (
                            <span title={`${locations.length - 3} more locations`} className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              +{locations.length - 3} more
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* Property types */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {(() => {
                      const propertyTypes = buyer.property_type ?? []
                      if (propertyTypes.length === 0) {
                        return <span className="text-xs text-muted-foreground">—</span>
                      }
                      return propertyTypes.map((type: string, index: number) => (
                        <span key={index} title={type} className="whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {type}
                        </span>
                      ))
                    })()}
                  </div>

                  {/* Created */}
                  <div className="text-xs text-muted-foreground">
                    {buyer.created_at
                      ? new Date(buyer.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "—"}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5">
                    {buyer.phone && (
                      <CallButton phone={buyer.phone} name={formatName(buyer)} buyerId={buyer.id} size="icon" variant="ghost" />
                    )}
                    {buyer.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => handleSendSms(buyer)}
                        aria-label={`Text ${formatName(buyer)}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    {buyer.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => handleSendEmail(buyer)}
                        aria-label={`Email ${formatName(buyer)}`}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    <Can permission="buyers.edit">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => handleEditBuyer(buyer)}
                        aria-label={`Edit ${formatName(buyer)}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Can>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`More options for ${formatName(buyer)}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Can permission="buyers.edit">
                          <DropdownMenuItem onClick={() => handleEditBuyer(buyer)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit buyer
                          </DropdownMenuItem>
                        </Can>
                        <DropdownMenuItem onClick={() => handleToggleBlock(buyer)}>
                          <Ban className="mr-2 h-4 w-4" /> {buyer.blocked_at ? "Unblock buyer" : "Block buyer"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Can permission="buyers.delete">
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400" onClick={() => setBuyerToDelete(buyer)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete buyer
                          </DropdownMenuItem>
                        </Can>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>

          {buyers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary mb-2">No buyers found</h3>
              <p className="text-sm text-secondary">
                {totalCount === 0 ? "Add your first buyer to get started" : "Try adjusting your filters"}
              </p>
              {Object.values(filters).some((v) => v !== "" && v !== "any") && (
                <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="border-t border-border bg-background px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <span>Rows</span>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[4.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {(() => {
                  const wanted = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
                  const sorted = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
                  const out: JSX.Element[] = []
                  let prev = 0
                  for (const n of sorted) {
                    if (n - prev > 1) out.push(<span key={`gap-${n}`} className="px-1 text-muted-foreground">…</span>)
                    out.push(
                      <Button
                        key={n}
                        size="icon"
                        variant={currentPage === n ? "default" : "outline"}
                        className={`h-8 w-8 ${currentPage === n ? "bg-brand text-white hover:bg-brand-hover" : ""}`}
                        onClick={() => setCurrentPage(n)}
                        aria-label={`Go to page ${n}`}
                        aria-current={currentPage === n ? "page" : undefined}
                      >
                        {n}
                      </Button>,
                    )
                    prev = n
                  }
                  return out
                })()}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Go to next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Can permission="buyers.edit">
        <AddBuyerModal
          open={showAddBuyerModal}
        onOpenChange={setShowAddBuyerModal}
        onSuccessAction={(_b) => {
          queryClient.invalidateQueries({ queryKey: ["buyers"] })
          queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
          queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
        }}
          onEditBuyer={(buyer) => {
            setEditingBuyer(buyer)
            setShowEditBuyerModal(true)
          }}
        />
      </Can>
      <Can permission="buyers.edit">
        <EditBuyerModal
          open={showEditBuyerModal}
        onOpenChange={handleEditBuyerModalChange}
        buyer={editingBuyer}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["buyers"] })
            queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
            queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
          }}
        />
      </Can>
      <SendSmsModal
        open={showSendSmsModal}
        onOpenChange={setShowSendSmsModal}
        buyer={smsBuyer}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["buyers"] })
          queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
          queryClient.invalidateQueries({ queryKey: ["totalBuyersCount"] })
        }}
      />
      <SendEmailModal
        open={showSendEmailModal}
        onOpenChange={setShowSendEmailModal}
        buyer={emailBuyer}
      />
      <CampaignChannelPicker
        open={campaignPickerOpen}
        onOpenChange={setCampaignPickerOpen}
        onSelect={(channel) => {
          if (campaignPickerSource === "selection" && selectedBuyers.length > 0) {
            saveAudienceSnapshot({
              createdAt: new Date().toISOString(),
              source: "buyers-filter",
              channel,
              buyerIds: selectedBuyers,
              recipientCount: selectedBuyers.length,
            })
            router.push(`/campaigns?prefill=${channel}`)
          } else {
            router.push(`/campaigns/new?type=${channel}`)
          }
          setCampaignPickerOpen(false)
        }}
      />
      <Dialog open={saveSegmentOpen} onOpenChange={setSaveSegmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as segment</DialogTitle>
            <DialogDescription>
              Save the current filter as a reusable audience in your library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g. Cash buyers in Texas"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={segmentDescription}
                onChange={(e) => setSegmentDescription(e.target.value)}
                placeholder="Optional"
                rows={2}
              />
            </div>
            {(filterMapping.droppedSearch || filterMapping.droppedReachability) && (
              <p className="text-xs text-muted-foreground">
                {filterMapping.droppedSearch && "Your typed search isn’t part of a saved segment. "}
                {filterMapping.droppedReachability &&
                  "Reachability toggles aren’t saved — channel reachability is applied automatically when you send."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSegmentOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!segmentName.trim() || savingSegment} onClick={handleSaveAsSegment}>
              {savingSegment ? "Saving…" : "Save segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BulkTagsDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        mode={tagActionMode}
        onSubmit={tagActionMode === "add" ? handleBulkAddTags : handleBulkRemoveTags}
        availableTags={removeTagOptions}
        loadingTags={removeTagsLoading}
      />
      <BulkGroupDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        mode={groupActionMode}
        onSubmit={
          groupActionMode === "add"
            ? handleBulkAddToGroup
            : groupActionMode === "remove"
              ? handleBulkRemoveFromGroup
              : handleBulkMoveToGroup
        }
      />

      <ConfirmInputDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title="Delete Buyers"
        description={`You are about to delete ${selectedBuyers.length} buyers.`}
        confirmationText="Delete Buyers"
        actionText="Delete"
        onConfirm={performBulkDelete}
      />

      <ConfirmInputDialog
        open={!!buyerToDelete}
        onOpenChange={(o) => !o && setBuyerToDelete(null)}
        title="Delete Buyer"
        description={buyerToDelete ? `Delete ${formatName(buyerToDelete)} permanently.` : ""}
        confirmationText="Delete Buyer"
        actionText="Delete"
        onConfirm={performDeleteBuyer}
      />
    </div>
  )
}

export default function BuyersPage() {
  return (
    <MainLayout>
      <BuyersPageContent />
    </MainLayout>
  )
}
