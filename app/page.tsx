"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import type { Buyer, Tag } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { BuyerService } from "@/services/buyer-service"
import { toast } from "sonner"
import ImportBuyersModal from "@/components/buyers/import-buyers-modal"
import AddBuyerModal from "@/components/buyers/add-buyer-modal"
import EditBuyerModal from "@/components/buyers/edit-buyer-modal"
import SendSmsModal from "@/components/buyers/send-sms-modal"
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
import MainLayout from "@/components/layout/main-layout"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Search,
  Star,
  Mail,
  MessageSquare,
  Phone,
  MoreHorizontal,
  CheckCircle,
  X,
  Edit,
  Loader2,
  MapPin,
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
} from "lucide-react"

import TagFilterSelector from "@/components/buyers/tag-filter-selector"
import LocationFilterSelector from "@/components/buyers/location-filter-selector"
import { exportBuyersToCSV } from "@/lib/export-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PROPERTY_TYPES } from "@/lib/constant"

const quickFilters = [
  { label: "VIP", key: "vip" },
  { label: "Hot Leads", key: "hot" },
  { label: "New This Week", key: "new" },
  { label: "High Score", key: "highScore" },
]


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

// Server-side filtering and pagination
const fetchBuyers = async (
  page: number,
  filters: FilterState,
  quickFilters: string[] = [],
  groupId?: string,
  perPage = DEFAULT_ITEMS_PER_PAGE,
) => {
  log("fetchBuyers", "Fetching buyers for page:", page, "with filters:", filters)

  let query = supabase.from("buyers")

  if (groupId) {
    query = query
      .select("*, buyer_groups!inner(group_id)", { count: "exact" })
      .eq("buyer_groups.group_id", groupId)
  } else {
    query = query.select("*", { count: "exact" })
  }

  query = query
    .eq("sendfox_hidden", false)
    .range((page - 1) * perPage, page * perPage - 1)
    .order("created_at", { ascending: false })

  // Apply server-side filters
  if (filters.search) {
    const encoded = encodeURIComponent(filters.search)
    query = query.or(
      `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
    )
  }

  if (filters.vip === "vip") {
    query = query.eq("vip", true)
  } else if (filters.vip === "not-vip") {
    query = query.eq("vip", false)
  }

  if (filters.vetted === "vetted") {
    query = query.eq("vetted", true)
  } else if (filters.vetted === "not-vetted") {
    query = query.eq("vetted", false)
  }

  if (filters.minScore) {
    query = query.gte("score", Number.parseInt(filters.minScore))
  }

  if (filters.maxScore) {
    query = query.lte("score", Number.parseInt(filters.maxScore))
  }

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter)
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore)
  }

  if (filters.selectedTags && filters.selectedTags.length > 0) {
    query = query.contains("tags", filters.selectedTags)
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const exclude = `{${filters.excludeTags
      .map((tag) => `"${tag}"`)
      .join(",")}}`
    query = query.not("tags", "ov", exclude)
  }

  if (filters.selectedLocations && filters.selectedLocations.length > 0) {
    query = query.overlaps("locations", filters.selectedLocations)
  }

  if (filters.propertyType && filters.propertyType !== "any") {
    query = query.overlaps("property_type", [filters.propertyType])
  }

  if (filters.canReceiveEmail === "yes") {
    query = query.eq("can_receive_email", true)
  } else if (filters.canReceiveEmail === "no") {
    query = query.eq("can_receive_email", false)
  }

  if (filters.canReceiveSMS === "yes") {
    query = query.eq("can_receive_sms", true)
  } else if (filters.canReceiveSMS === "no") {
    query = query.eq("can_receive_sms", false)
  }

  if (quickFilters.includes("vip")) {
    query = query.eq("vip", true)
  }

  if (quickFilters.includes("hot")) {
    query = query.gte("score", 85)
  }

  if (quickFilters.includes("new")) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte("created_at", sevenDaysAgo.toISOString())
  }

  if (quickFilters.includes("highScore")) {
    query = query.gte("score", 90)
  }

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
  quickFilters: string[] = [],
  groupId?: string,
) => {
  let query = supabase.from("buyers")

  if (groupId) {
    query = query
      .select("id,buyer_groups!inner(group_id)")
      .eq("buyer_groups.group_id", groupId)
  } else {
    query = query.select("id")
  }

  query = query.eq("sendfox_hidden", false)
  // Apply same filters as fetchBuyers
  if (filters.search) {
    const encoded = encodeURIComponent(filters.search)
    query = query.or(
      `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
    )
  }

  if (filters.vip === "vip") {
    query = query.eq("vip", true)
  } else if (filters.vip === "not-vip") {
    query = query.eq("vip", false)
  }

  if (filters.vetted === "vetted") {
    query = query.eq("vetted", true)
  } else if (filters.vetted === "not-vetted") {
    query = query.eq("vetted", false)
  }

  if (filters.minScore) {
    query = query.gte("score", Number.parseInt(filters.minScore))
  }

  if (filters.maxScore) {
    query = query.lte("score", Number.parseInt(filters.maxScore))
  }

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter)
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore)
  }

  if (filters.selectedTags && filters.selectedTags.length > 0) {
    query = query.contains("tags", filters.selectedTags)
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const exclude = `{${filters.excludeTags
      .map((tag) => `"${tag}"`)
      .join(",")}}`
    query = query.not("tags", "ov", exclude)
  }

  if (filters.selectedLocations && filters.selectedLocations.length > 0) {
    query = query.overlaps("locations", filters.selectedLocations)
  }

  if (filters.propertyType && filters.propertyType !== "any") {
    query = query.overlaps("property_type", [filters.propertyType])
  }

  if (filters.canReceiveEmail === "yes") {
    query = query.eq("can_receive_email", true)
  } else if (filters.canReceiveEmail === "no") {
    query = query.eq("can_receive_email", false)
  }

  if (filters.canReceiveSMS === "yes") {
    query = query.eq("can_receive_sms", true)
  } else if (filters.canReceiveSMS === "no") {
    query = query.eq("can_receive_sms", false)
  }

  if (quickFilters.includes("vip")) {
    query = query.eq("vip", true)
  }

  if (quickFilters.includes("hot")) {
    query = query.gte("score", 85)
  }

  if (quickFilters.includes("new")) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte("created_at", sevenDaysAgo.toISOString())
  }

  if (quickFilters.includes("highScore")) {
    query = query.gte("score", 90)
  }

  const { data, error } = await query

  if (error) {
    log("error", "Failed to fetch buyer ids", { error })
    throw error
  }

  return (data || []).map((row: any) => row.id) as string[]
}

// Fetch all buyers data for export when selecting all
const fetchAllBuyersData = async (
  filters: FilterState,
  quickFilters: string[] = [],
  groupId?: string,
) => {
  let query = supabase.from("buyers")

  if (groupId) {
    query = query
      .select("* , buyer_groups!inner(group_id)")
      .eq("buyer_groups.group_id", groupId)
  } else {
    query = query.select("*")
  }

  // Apply same filters as above
  if (filters.search) {
    const encoded = encodeURIComponent(filters.search)
    query = query.or(
      `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
    )
  }

  if (filters.vip === "vip") {
    query = query.eq("vip", true)
  } else if (filters.vip === "not-vip") {
    query = query.eq("vip", false)
  }

  if (filters.vetted === "vetted") {
    query = query.eq("vetted", true)
  } else if (filters.vetted === "not-vetted") {
    query = query.eq("vetted", false)
  }

  if (filters.minScore) {
    query = query.gte("score", Number.parseInt(filters.minScore))
  }

  if (filters.maxScore) {
    query = query.lte("score", Number.parseInt(filters.maxScore))
  }

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter)
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore)
  }

  if (filters.selectedTags && filters.selectedTags.length > 0) {
    query = query.contains("tags", filters.selectedTags)
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const exclude = `{${filters.excludeTags
      .map((tag) => `"${tag}"`)
      .join(",")}}`
    query = query.not("tags", "ov", exclude)
  }

  if (filters.selectedLocations && filters.selectedLocations.length > 0) {
    query = query.overlaps("locations", filters.selectedLocations)
  }

  if (filters.propertyType && filters.propertyType !== "any") {
    query = query.overlaps("property_type", [filters.propertyType])
  }

  if (filters.canReceiveEmail === "yes") {
    query = query.eq("can_receive_email", true)
  } else if (filters.canReceiveEmail === "no") {
    query = query.eq("can_receive_email", false)
  }

  if (filters.canReceiveSMS === "yes") {
    query = query.eq("can_receive_sms", true)
  } else if (filters.canReceiveSMS === "no") {
    query = query.eq("can_receive_sms", false)
  }

  if (quickFilters.includes("vip")) {
    query = query.eq("vip", true)
  }

  if (quickFilters.includes("hot")) {
    query = query.gte("score", 85)
  }

  if (quickFilters.includes("new")) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte("created_at", sevenDaysAgo.toISOString())
  }

  if (quickFilters.includes("highScore")) {
    query = query.gte("score", 90)
  }

  const { data, error } = await query

  if (error) {
    log("error", "Failed to fetch all buyers", { error })
    throw error
  }

  const buyersOnly = (data || []).map((row: any) => {
    const { buyer_groups, ...rest } = row
    return rest
  })

  return buyersOnly as Buyer[]
}

const fetchBuyersByIds = async (ids: string[]): Promise<Buyer[]> => {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .in("id", ids)

  if (error) {
    log("error", "Failed to fetch buyers by ids", { error })
    throw error
  }

  return (data || []) as Buyer[]
}

function BuyersPageContent() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const suppressBuyerModalAutoOpenRef = useRef(false)

  // UI state
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([])
  const [allSelected, setAllSelected] = useState(false)
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([])
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [showEditBuyerModal, setShowEditBuyerModal] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null)
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [smsBuyer, setSmsBuyer] = useState<Buyer | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tagActionMode, setTagActionMode] = useState<"add" | "remove">("add")
  const [showTagDialog, setShowTagDialog] = useState(false)
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
      activeQuickFilters,
      selectedGroupId,
    ],
    queryFn: () =>
      fetchBuyers(
        currentPage,
        { ...filters, search: debouncedSearch },
        activeQuickFilters,
        selectedGroupId,
        itemsPerPage,
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
    keepPreviousData: true,
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
  })

  // React Query for buyer counts by group
  const { data: buyerCounts = {}, isLoading: countsLoading } = useQuery({
    queryKey: ["buyerCountsByGroup"],
    queryFn: BuyerService.getBuyerCountsByGroup,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // React Query for total buyer count
  const { data: totalBuyersCount = 0, isLoading: totalCountLoading } = useQuery({
    queryKey: ["totalBuyersCount"],
    queryFn: BuyerService.getTotalBuyerCount,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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
    (buyersLoading && !buyersData) || tagsLoading || countsLoading || totalCountLoading
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
    if (currentPage < totalPages) {
      queryClient.prefetchQuery({
        queryKey: [
          "buyers",
          currentPage + 1,
          itemsPerPage,
          { ...filters, search: debouncedSearch },
          activeQuickFilters,
          selectedGroupId,
        ],
        queryFn: () =>
          fetchBuyers(
            currentPage + 1,
            { ...filters, search: debouncedSearch },
            activeQuickFilters,
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
    activeQuickFilters,
    itemsPerPage,
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
    activeQuickFilters,
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
    let selectedBuyerData: Buyer[] = []

    if (allSelected) {
      selectedBuyerData = await fetchAllBuyersData(
        { ...filters, search: debouncedSearch },
        activeQuickFilters,
        selectedGroupId,
      )
    } else {
      const missingIds = selectedBuyers.filter(
        (id) => !buyers.find((b: Buyer) => b.id === id),
      )
      const extra = missingIds.length
        ? await fetchAllBuyersData(
            { ...filters, search: debouncedSearch },
            activeQuickFilters,
            selectedGroupId,
          )
        : []
      selectedBuyerData = [
        ...buyers.filter((buyer: Buyer) => selectedBuyers.includes(buyer.id)),
        ...(extra || []).filter((b) => selectedBuyers.includes(b.id)),
      ]
    }
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `buyers-export-${timestamp}.csv`
    exportBuyersToCSV(selectedBuyerData, filename)
    toast.success("Export started")
  }

  // Bulk actions
  const handleBulkAddTags = async (tagsToAdd: string[]) => {
    try {
      const missingIds = selectedBuyers.filter(
        (id) => !buyers.find((b: Buyer) => b.id === id),
      )
      const extraBuyers = await fetchBuyersByIds(missingIds)
      const buyersToUpdate = [
        ...buyers.filter((b: Buyer) => selectedBuyers.includes(b.id)),
        ...extraBuyers,
      ]

      for (const buyer of buyersToUpdate) {
        const currentTags = buyer.tags || []
        const newTags = [...new Set([...currentTags, ...tagsToAdd])]

        await supabase.from("buyers").update({ tags: newTags }).eq("id", buyer.id)
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
      setSelectedBuyers([])
      toast.success("Tags added")
    } catch (err) {
      log("error", "Failed to add tags", { error: err })
      toast.error("Failed to add tags")
    }
  }

  const handleBulkRemoveTags = async (tagsToRemove: string[]) => {
    try {
      const missingIds = selectedBuyers.filter(
        (id) => !buyers.find((b: Buyer) => b.id === id),
      )
      const extraBuyers = await fetchBuyersByIds(missingIds)
      const buyersToUpdate = [
        ...buyers.filter((b: Buyer) => selectedBuyers.includes(b.id)),
        ...extraBuyers,
      ]

      for (const buyer of buyersToUpdate) {
        const currentTags = buyer.tags || []
        const newTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag))

        await supabase.from("buyers").update({ tags: newTags }).eq("id", buyer.id)
      }

      queryClient.invalidateQueries({ queryKey: ["buyers"] })
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
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
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
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
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
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
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
      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      setSelectedBuyers([])
      toast.success("Removed from all groups")
    } catch (err) {
      log("error", "Failed to remove from all groups", { error: err })
      toast.error("Failed to remove from all groups")
    }
  }

  const performBulkDelete = async () => {
    try {
      await fetch("/api/buyers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedBuyers }),
      }).then((r) => {
        if (!r.ok) throw new Error("bulk delete failed")
      })
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
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

  const performDeleteBuyer = async () => {
    if (!buyerToDelete) return
    try {
      await fetch(`/api/buyers/${buyerToDelete.id}/delete`, {
        method: "POST",
      }).then((r) => {
        if (!r.ok) throw new Error("delete failed")
      })
      queryClient.invalidateQueries({ queryKey: ["buyers"] })
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
      activeQuickFilters,
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

  const toggleQuickFilter = (filterKey: string) => {
    setActiveQuickFilters((prev: string[]) =>
      prev.includes(filterKey) ? prev.filter((f: string) => f !== filterKey) : [...prev, filterKey],
    )
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
    setActiveQuickFilters([])
    setSelectedGroupId("")
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50"
    if (score >= 70) return "text-blue-600 bg-blue-50"
    if (score >= 50) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "lead":
        return "chip-blue"
      case "qualified":
        return "chip-green"
      case "active":
        return "chip-orange"
      case "under_contract":
        return "chip-blue"
      case "closed":
        return "chip-green"
      default:
        return "chip-blue"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
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
    <div className="flex h-screen bg-background overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Smart Groups Sidebar - Responsive width */}
      <div
        className={`
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0 fixed xl:static inset-y-0 left-0 z-50
        w-[15rem] xl:w-64 border-r bg-background transition-transform duration-300 ease-in-out
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
                <h1 className="text-xl lg:text-2xl font-bold">👥 Buyers</h1>
                <Badge variant="secondary" className="text-sm">
                  {totalCount} results
                </Badge>
                {totalCount > itemsPerPage && (
                  <Badge variant="outline" className="text-sm hidden sm:inline-flex">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="btn-primary"
                  onClick={() => setShowAddBuyerModal(true)}
                  aria-label="Add a new buyer manually"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Buyer
                </Button>
                <ImportBuyersModal
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["buyers"] })
                    queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
                  }}
                />
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
                <Button asChild className="btn-secondary" aria-label="Create a new marketing campaign">
                  <Link href="/campaigns/new">
                    <Target className="mr-1 h-4 w-4" /> Campaign
                  </Link>
                </Button>
              </div>
            </div>

            {/* Enhanced Bulk Actions - More compact */}
              {selectedBuyers.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-3 lg:p-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{selectedBuyers.length} selected</Badge>
                    {!allSelected && selectedBuyers.length < totalCount && (
                      <button
                        className="text-xs underline"
                        onClick={handleSelectAllResults}
                      >
                        Select all {totalCount} buyers
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 flex-wrap">
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
                          Add Tags
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setTagActionMode("remove")
                            setShowTagDialog(true)
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove Tags
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
                          Remove from Group
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

                    <Button asChild size="sm" className="btn-secondary" aria-label="Create campaign with selected buyers">
                      <Link href={`/campaigns/new?buyers=${selectedBuyers.join(",")}`}>
                        <Target className="mr-1 h-4 w-4" /> Campaign
                      </Link>
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      aria-label="Delete selected buyers"
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
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
              </div>
            )}

            {/* Quick Filters - More compact */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={activeQuickFilters.includes(filter.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleQuickFilter(filter.key)}
                  className="h-7 text-xs"
                  aria-label={`Filter by ${filter.label}`}
                >
                  {filter.label}
                  {activeQuickFilters.includes(filter.key) && <X className="ml-1 h-3 w-3" />}
                </Button>
              ))}
            </div>

            {/* Filters - More responsive grid */}
            <div className="space-y-4">
              {/* Search and Location - First Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="search-input" className="block text-sm font-medium text-muted-foreground mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-input"
                      placeholder="Search by name, phone, email, or company"
                      className="pl-9"
                      value={filters.search}
                      onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="location-filter" className="block text-sm font-medium text-muted-foreground mb-2">
                    Location
                  </label>
                  <LocationFilterSelector
                    selectedLocations={filters.selectedLocations || []}
                    onChange={(selectedLocations: string[]) => setFilters((prev) => ({ ...prev, selectedLocations }))}
                    placeholder="Select locations to filter by..."
                  />
                </div>
              </div>

              {/* Include Tags, Exclude Tags, Property Type - Second Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="include-tags" className="block text-sm font-medium text-muted-foreground mb-2">
                    Include Tags
                  </label>
                  <TagFilterSelector
                    availableTags={tags}
                    selectedTags={filters.selectedTags || []}
                    onChange={(selectedTags: string[]) => setFilters((prev) => ({ ...prev, selectedTags }))}
                    placeholder="Select tags to include..."
                  />
                </div>
                <div>
                  <label htmlFor="exclude-tags" className="block text-sm font-medium text-muted-foreground mb-2">
                    Exclude Tags
                  </label>
                  <TagFilterSelector
                    availableTags={tags}
                    selectedTags={filters.excludeTags || []}
                    onChange={(excludeTags: string[]) => setFilters((prev) => ({ ...prev, excludeTags }))}
                    placeholder="Select tags to exclude..."
                    variant="exclude"
                  />
                </div>
                <div>
                  <label
                    htmlFor="property-type-filter"
                    className="block text-sm font-medium text-muted-foreground mb-2"
                  >
                    Property Type
                  </label>
                  <Select
                    value={filters.propertyType}
                    onValueChange={(value: string) => setFilters((prev) => ({ ...prev, propertyType: value }))}
                  >
                    <SelectTrigger id="property-type-filter">
                      <SelectValue placeholder="Any property type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any property type</SelectItem>
                      {PROPERTY_TYPES.map((type: string) => (
                        <SelectItem key={type} value={type.toLowerCase()}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Collapsible Advanced Filters */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Advanced Filters
                </summary>
                <div className="mt-4 space-y-4">
                  {/* Score Range and Date Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label htmlFor="min-score" className="block text-sm font-medium text-muted-foreground mb-2">
                        Min Score
                      </label>
                      <Input
                        id="min-score"
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        value={filters.minScore}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minScore: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="max-score" className="block text-sm font-medium text-muted-foreground mb-2">
                        Max Score
                      </label>
                      <Input
                        id="max-score"
                        type="number"
                        placeholder="100"
                        min="0"
                        max="100"
                        value={filters.maxScore}
                        onChange={(e) => setFilters((prev) => ({ ...prev, maxScore: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="created-after" className="block text-sm font-medium text-muted-foreground mb-2">
                        Created After
                      </label>
                      <Input
                        id="created-after"
                        type="date"
                        value={filters.createdAfter}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdAfter: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="created-before" className="block text-sm font-medium text-muted-foreground mb-2">
                        Created Before
                      </label>
                      <Input
                        id="created-before"
                        type="date"
                        value={filters.createdBefore}
                        onChange={(e) => setFilters((prev) => ({ ...prev, createdBefore: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Status Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label htmlFor="vip-status" className="block text-sm font-medium text-muted-foreground mb-2">
                        VIP Status
                      </label>
                      <Select
                        value={filters.vip}
                        onValueChange={(value: string) => setFilters((prev) => ({ ...prev, vip: value }))}
                      >
                        <SelectTrigger id="vip-status">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="vip">VIP Only</SelectItem>
                          <SelectItem value="not-vip">Non-VIP Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="vetted-status" className="block text-sm font-medium text-muted-foreground mb-2">
                        Vetted Status
                      </label>
                      <Select
                        value={filters.vetted}
                        onValueChange={(value: string) => setFilters((prev) => ({ ...prev, vetted: value }))}
                      >
                        <SelectTrigger id="vetted-status">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="vetted">Vetted Only</SelectItem>
                          <SelectItem value="not-vetted">Non-Vetted Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="email-status" className="block text-sm font-medium text-muted-foreground mb-2">
                        Can Receive Email
                      </label>
                      <Select
                        value={filters.canReceiveEmail}
                        onValueChange={(value: string) => setFilters((prev) => ({ ...prev, canReceiveEmail: value }))}
                      >
                        <SelectTrigger id="email-status">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="sms-status" className="block text-sm font-medium text-muted-foreground mb-2">
                        Can Receive SMS
                      </label>
                      <Select
                        value={filters.canReceiveSMS}
                        onValueChange={(value: string) => setFilters((prev) => ({ ...prev, canReceiveSMS: value }))}
                      >
                        <SelectTrigger id="sms-status">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
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

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <Button variant="destructive" onClick={clearAllFilters} aria-label="Clear all active filters">
                  Reset All Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table - Horizontal scroll on smaller screens */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full overflow-x-auto">
            <table className="w-full border-collapse min-w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-3 text-left w-10 text-heading">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all buyers on this page"
                    />
                  </th>
                  <th className="p-3 text-left text-heading">Name</th>
                  <th className="p-3 text-left text-heading">Email</th>
                  <th className="p-3 text-left text-heading">Phone</th>
                  <th className="p-3 text-left text-heading">Score</th>
                  <th className="p-3 text-left text-heading">Tags</th>
                  <th className="p-3 text-left text-heading">Locations</th>
                  <th className="p-3 text-left text-heading">Created</th>
                  <th className="p-3 text-left text-heading">Status</th>
                  <th className="p-3 text-left text-heading w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((buyer: Buyer) => (
                  <tr key={buyer.id} className="row-base divider-row tr-hover group h-16 first:border-t-0">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedBuyers.includes(buyer.id)}
                        onCheckedChange={() => toggleSelectBuyer(buyer.id)}
                        aria-label={`Select ${formatName(buyer)}`}
                      />
                    </td>
                    <td className="p-3 text-body font-medium">
                      <div className="flex items-center justify-between min-w-0">
                        <div className="truncate mr-2 text-sm font-semibold text-heading">{formatName(buyer)}</div>
                        <div className="flex items-center space-x-1">
                          {buyer.vip && (
                            <span title="VIP Client">
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            </span>
                          )}
                          {buyer.vetted && (
                            <span title="Vetted Buyer">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </span>
                          )}
                        </div>
                      </div>
                      {buyer.company && <div className="text-xs text-secondary">{buyer.company}</div>}
                    </td>
                    <td className="p-3 max-w-[12rem] truncate text-body">
                      {buyer.email || "No email"}
                    </td>
                    <td className="p-3 font-mono text-sm whitespace-nowrap text-body">{buyer.phone || "No phone"}</td>
                    <td className="p-3 text-body">
                      <Badge
                        className={`${getScoreColor(buyer.score)} border-0`}
                        title={`Buyer score: ${buyer.score}/100`}
                      >
                        {buyer.score}
                      </Badge>
                    </td>
                    <td className="p-3 text-body">
                      <div className="flex flex-wrap gap-1 max-w-40">
                        {buyer.tags?.slice(0, 3).map((tag: string, index: number) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs px-2 py-0.5 whitespace-nowrap"
                            title={tag}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {buyer.tags && buyer.tags.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5"
                            title={`${buyer.tags.length - 3} more tags`}
                          >
                            +{buyer.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-body">
                      <div className="flex flex-wrap gap-1 max-w-40">
                        {buyer.locations?.slice(0, 2).map((location: string, index: number) => (
                          <span
                            key={index}
                            className="chip chip-blue flex items-center gap-1"
                            title={location}
                          >
                            <MapPin className="h-3 w-3" />
                            {location}
                          </span>
                        ))}
                        {buyer.locations && buyer.locations.length > 2 && (
                          <span
                            className="chip chip-blue"
                            title={`${buyer.locations.length - 2} more locations`}
                          >
                            +{buyer.locations.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-secondary font-mono whitespace-nowrap">
                      {formatDate(buyer.created_at)}
                    </td>
                    <td className="p-3 text-body">
                      <div className="flex flex-col space-y-2">
                        <span className={`${getStatusColor(buyer.status)} chip w-fit`}>
                          {buyer.status.charAt(0).toUpperCase() + buyer.status.slice(1)}
                        </span>
                        <div className="flex items-center space-x-2">
                          {buyer.can_receive_email && (
                            <span title="Can receive email">
                              <Mail className="h-4 w-4 text-blue-500" />
                            </span>
                          )}
                          {buyer.can_receive_sms && (
                            <span title="Can receive SMS">
                              <MessageSquare className="h-4 w-4 text-purple-500" />
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 group"
                          aria-label={`Send email to ${formatName(buyer)}`}
                        >
                          <Mail className="h-4 w-4 text-gray-500 group-hover:text-sky-600 transition" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 group"
                          onClick={() => handleSendSms(buyer)}
                          aria-label={`Send SMS to ${formatName(buyer)}`}
                        >
                          <MessageSquare className="h-4 w-4 text-gray-500 group-hover:text-sky-600 transition" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 group"
                          aria-label={`Call ${formatName(buyer)}`}
                        >
                          <Phone className="h-4 w-4 text-gray-500 group-hover:text-sky-600 transition" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 group"
                          onClick={() => handleEditBuyer(buyer)}
                          aria-label={`Edit ${formatName(buyer)}`}
                        >
                          <Edit className="h-4 w-4 text-gray-500 group-hover:text-sky-600 transition" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 group"
                              aria-label={`More options for ${formatName(buyer)}`}
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-500 group-hover:text-sky-600 transition" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => setBuyerToDelete(buyer)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                log("buyers", "Block buyer:", buyer.id)
                              }}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Block
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {buyers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary mb-2">No buyers found</h3>
              <p className="text-sm text-secondary">
                {totalCount === 0 ? "Add your first buyer to get started" : "Try adjusting your filters"}
              </p>
              {(Object.values(filters).some((v) => v !== "" && v !== "any") || activeQuickFilters.length > 0) && (
                <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Pagination - More compact on mobile */}
        {totalPages > 1 && (
          <div className="border-t bg-background p-3 lg:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)}{" "}
                of {totalCount} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                        aria-label={`Go to page ${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">Rows:</span>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="w-20 h-8">
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
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Go to next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddBuyerModal
        open={showAddBuyerModal}
        onOpenChange={setShowAddBuyerModal}
        onSuccessAction={(_b) => queryClient.invalidateQueries({ queryKey: ["buyers"] })}
        onEditBuyer={(buyer) => {
          setEditingBuyer(buyer)
          setShowEditBuyerModal(true)
        }}
      />
      <EditBuyerModal
        open={showEditBuyerModal}
        onOpenChange={handleEditBuyerModalChange}
        buyer={editingBuyer}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["buyers"] })}
      />
      <SendSmsModal
        open={showSendSmsModal}
        onOpenChange={setShowSendSmsModal}
        buyer={smsBuyer}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["buyers"] })}
      />
      <BulkTagsDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        mode={tagActionMode}
        onSubmit={tagActionMode === "add" ? handleBulkAddTags : handleBulkRemoveTags}
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
