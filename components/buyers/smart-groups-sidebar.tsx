"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import { createLogger } from "@/lib/logger"
import { toast } from "sonner"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Folder,
  Users,
  Star,
  Zap,
  DollarSign,
  TrendingUp,
  Home,
  Building,
  ClipboardList,
  FileText,
  UserX,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderPlus,
  Tag,
  GripVertical,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const ICON_OPTIONS = [
  { value: "users", label: "Users", icon: Users },
  { value: "star", label: "Star", icon: Star },
  { value: "zap", label: "Zap", icon: Zap },
  { value: "dollar-sign", label: "Dollar", icon: DollarSign },
  { value: "trending-up", label: "Trending", icon: TrendingUp },
  { value: "home", label: "Home", icon: Home },
  { value: "building", label: "Building", icon: Building },
  { value: "clipboard-list", label: "List", icon: ClipboardList },
  { value: "file-text", label: "File", icon: FileText },
  { value: "user-x", label: "Cold", icon: UserX },
] as const

type IconValue = (typeof ICON_OPTIONS)[number]["value"]

const COLOR_OPTIONS = [
  { value: "#F0303A", label: "Brand" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#84cc16", label: "Lime" },
  { value: "#22c55e", label: "Green" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
] as const

type ColorValue = (typeof COLOR_OPTIONS)[number]["value"]
interface StoredFolder {
  id: string
  name: string
  expanded?: boolean
  order?: number
  groupOrder?: string[]
}

const loadFolderSettings = (): StoredFolder[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("buyerGroupFolders")
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const saveFolderSettings = (folders: GroupFolder[]) => {
  if (typeof window === "undefined") return
  const data: StoredFolder[] = folders.map((f, idx) => ({
    id: f.id,
    name: f.name,
    expanded: f.expanded,
    order: idx,
    groupOrder: f.groups.map((g) => g.id),
  }))
  localStorage.setItem("buyerGroupFolders", JSON.stringify(data))
}
import type { Group } from "@/lib/supabase"
import { getGroups, createGroup, updateGroup, deleteGroup } from "@/lib/group-service"

const log = createLogger("smart-groups-sidebar")

interface SmartGroupsSidebarProps {
  onGroupSelect?: (groupId: string) => void
  selectedGroupId?: string
  buyerCounts?: Record<string, number>
  totalBuyers?: number
  filteredBuyers?: number
}

interface GroupFolder {
  id: string
  name: string
  groups: Group[]
  expanded: boolean
}

// A single draggable/sortable group row. Only the GripVertical handle starts a
// drag (via {...attributes} {...listeners}); the rest of the row keeps its
// click-to-select behavior.
function SortableGroupItem({
  group,
  folderId,
  isSelected,
  count,
  icon,
  onSelect,
  onEdit,
  onDelete,
}: {
  group: Group
  folderId: string
  isSelected: boolean
  count: number
  icon: React.ReactNode
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id, data: { type: "group", folderId } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    ...(isSelected ? { boxShadow: "inset 2px 0 0 #F0303A" } : {}),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer ${
        isSelected ? "bg-brand/5 text-foreground" : "hover:bg-muted/60"
      }`}
      onClick={onSelect}
      title={`Select ${group.name} group`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag to reorder ${group.name}`}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {icon}
        <span className="text-sm min-w-0 flex-1 truncate" title={group.name}>{group.name}</span>
      </div>
      <div className="flex items-center space-x-1">
        <Badge variant="secondary" className="text-xs text-muted-foreground shrink-0">
          {count}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Group options">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// A draggable/sortable folder. Only the GripVertical handle starts a drag; the
// header keeps its expand/collapse and menu behavior. `children` holds the
// expanded group list (its own nested SortableContext).
function SortableFolder({
  folder,
  onToggle,
  onEdit,
  onAddGroup,
  onDelete,
  children,
}: {
  folder: GroupFolder
  onToggle: () => void
  onEdit: () => void
  onAddGroup: () => void
  onDelete?: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id, data: { type: "folder" } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="group flex items-center justify-between">
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none px-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag to reorder ${folder.name}`}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Button
          variant="ghost"
          className="flex-1 justify-start px-2 py-1.5 h-auto"
          onClick={onToggle}
          title={`${folder.expanded ? "Collapse" : "Expand"} ${folder.name}`}
        >
          {folder.expanded ? (
            <ChevronDown className="h-4 w-4 mr-2" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-2" />
          )}
          <Folder className="h-4 w-4 mr-2" />
          <span className="font-medium text-sm whitespace-nowrap">{folder.name}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" title="Folder options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddGroup}>
              <Plus className="mr-2 h-4 w-4" />
              Add Group to Folder
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-red-600 dark:text-red-400">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Folder
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {folder.expanded && children}
    </div>
  )
}

// Remove the placeholderGroups and use real data
export default function SmartGroupsSidebar({
  onGroupSelect,
  selectedGroupId,
  buyerCounts = {},
  totalBuyers,
  filteredBuyers,
}: SmartGroupsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [groups, setGroups] = useState<Group[]>([])
  const [folders, setFolders] = useState<GroupFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showEditFolder, setShowEditFolder] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [editingFolder, setEditingFolder] = useState<GroupFolder | null>(null)
  const [dragGroup, setDragGroup] = useState<{ id: string; folderId: string } | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<GroupFolder | null>(null)

  // Form states
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    type: "manual",
    color: "#F0303A",
    icon: "users",
    folder: "",
  })
  const [folderForm, setFolderForm] = useState({
    name: "",
  })

  useEffect(() => {
    organizeFolders(groups)
  }, [groups])

  // Load groups from database
  const loadGroups = useCallback(async () => {
    try {
      setLoading(true)
      const groupsData = await getGroups()
      setGroups(groupsData)
      organizeFolders(groupsData)
    } catch (err) {
      log("error", "Failed to load groups", { error: err })
      toast.error("Failed to load groups")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const organizeFolders = (groupsData: Group[]) => {
    const saved = loadFolderSettings()

    const baseFolders: GroupFolder[] = [
      { id: "priority-segments", name: "Priority Segments", groups: [], expanded: true },
      { id: "buyer-types", name: "Buyer Types", groups: [], expanded: true },
      { id: "custom-groups", name: "Custom Groups", groups: [], expanded: true },
    ]

    // Apply saved settings and add custom folders
    saved.forEach((sf) => {
      const existing = baseFolders.find((f) => f.id === sf.id)
      if (existing) {
        existing.name = sf.name
        if (typeof sf.expanded === "boolean") existing.expanded = sf.expanded
      } else {
        baseFolders.push({ id: sf.id, name: sf.name, expanded: sf.expanded ?? true, groups: [] })
      }
    })

    // Categorize groups into folders
    groupsData.forEach((group) => {
      const folderId = String(group.criteria?.folder || "custom-groups")
      let folder = baseFolders.find((f) => f.id === folderId)
      if (!folder) {
        folder = { id: folderId, name: folderId, groups: [], expanded: true }
        baseFolders.push(folder)
      }
      folder.groups.push(group)
    })

    // Apply saved ordering
    baseFolders.forEach((folder) => {
      const savedFolder = saved.find((sf) => sf.id === folder.id)
      if (savedFolder?.groupOrder) {
        folder.groups.sort((a, b) => {
          const order = savedFolder.groupOrder as string[]
          const ai = order.indexOf(a.id)
          const bi = order.indexOf(b.id)
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      }
    })

    baseFolders.sort((a, b) => {
      const aOrder = saved.find((sf) => sf.id === a.id)?.order ?? 0
      const bOrder = saved.find((sf) => sf.id === b.id)?.order ?? 0
      return aOrder - bOrder
    })

    setFolders(baseFolders)
    saveFolderSettings(baseFolders)
  }

  const handleCreateGroup = async () => {
    try {
      const criteria = {
        folder: groupForm.folder || "custom-groups",
        icon: groupForm.icon,
      }

      const newGroup = await createGroup({
        name: groupForm.name,
        description: groupForm.description,
        type: groupForm.type as "manual" | "smart",
        color: groupForm.color,
        criteria,
      })

      await loadGroups() // Reload from database
      setShowCreateGroup(false)
      setGroupForm({ name: "", description: "", type: "manual", color: "#F0303A", icon: "users", folder: "" })
      toast.success("Group created")
      log("info", "Group created", { id: newGroup.id })
    } catch (err) {
      log("error", "Failed to create group", { error: err })
      const msg = err instanceof Error ? err.message : "Failed to create group."
      toast.error(msg)
    }
  }

  const handleEditGroup = async () => {
    if (!editingGroup) return

    try {
      const criteria = {
        ...(editingGroup.criteria || {}),
        folder: groupForm.folder || editingGroup.criteria?.folder || "custom-groups",
        icon: groupForm.icon,
      }

      await updateGroup(editingGroup.id, {
        name: groupForm.name,
        description: groupForm.description,
        color: groupForm.color,
        criteria,
      })

      await loadGroups() // Reload from database
      setEditingGroup(null)
      setGroupForm({ name: "", description: "", type: "manual", color: "#F0303A", icon: "users", folder: "" })
      toast.success("Group updated")
      log("info", "Group updated", { id: editingGroup.id })
    } catch (err) {
      log("error", "Failed to update group", { error: err })
      toast.error("Failed to update group. Please try again.")
    }
  }

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return

    try {
      await deleteGroup(groupToDelete.id)
      await loadGroups() // Reload from database
      toast.success("Group deleted")
      log("info", "Group deleted", { id: groupToDelete.id })
    } catch (err) {
      log("error", "Failed to delete group", { error: err })
      toast.error("Failed to delete group. Please try again.")
    } finally {
      setGroupToDelete(null)
    }
  }

  const handleCreateFolder = () => {
    const newFolder: GroupFolder = {
      id: `custom-${Date.now()}`,
      name: folderForm.name,
      groups: [],
      expanded: true,
    }

    setFolders([...folders, newFolder])
    saveFolderSettings([...folders, newFolder])
    setShowCreateFolder(false)
    setFolderForm({ name: "" })
  }

  const handleEditFolder = () => {
    if (!editingFolder) return

    const updated = folders.map((folder) => (folder.id === editingFolder.id ? { ...folder, name: folderForm.name } : folder))
    setFolders(updated)
    saveFolderSettings(updated)
    setShowEditFolder(false)
    setEditingFolder(null)
    setFolderForm({ name: "" })
  }

  const handleDeleteFolder = () => {
    if (!folderToDelete) return

    const folderId = folderToDelete.id
    const folderToDel = folders.find((f) => f.id === folderId)
    if (folderToDel) {
      const customGroupsFolder = folders.find((f) => f.id === "custom-groups")
      if (customGroupsFolder) {
        customGroupsFolder.groups = [...customGroupsFolder.groups, ...folderToDel.groups]
      }
      const updated = folders.filter((f) => f.id !== folderId)
      setFolders(updated)
      saveFolderSettings(updated)
    }
    setFolderToDelete(null)
  }

  const toggleFolder = (folderId: string) => {
    setFolders((prev) => {
      const updated = prev.map((folder) =>
        folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder,
      )
      saveFolderSettings(updated)
      return updated
    })
  }

  // @dnd-kit sensors: pointer needs a 5px move so a normal click still selects
  // the group, keyboard sensor enables accessible reordering.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Single drag-end handler for the whole sidebar. Folder order persists by
  // array index (saveFolderSettings); within-folder group order persists via
  // each folder's groupOrder, both re-applied by organizeFolders on reload.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const type = active.data.current?.type

    if (type === "folder") {
      setFolders((prev) => {
        const oldIndex = prev.findIndex((f) => f.id === active.id)
        const newIndex = prev.findIndex((f) => f.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        const reordered = arrayMove(prev, oldIndex, newIndex)
        saveFolderSettings(reordered)
        return reordered
      })
      return
    }

    if (type === "group") {
      // Only reorder when active and over groups live in the SAME folder; the
      // folder containing both is the one where both indices resolve.
      setFolders((prev) => {
        const updated = prev.map((folder) => {
          const oldIndex = folder.groups.findIndex((g) => g.id === active.id)
          const newIndex = folder.groups.findIndex((g) => g.id === over.id)
          if (oldIndex === -1 || newIndex === -1) return folder
          return { ...folder, groups: arrayMove(folder.groups, oldIndex, newIndex) }
        })
        saveFolderSettings(updated)
        return updated
      })
    }
  }

  const moveGroup = async (
    source: { id: string; folderId: string },
    target: { id: string; folderId: string } | { folderId: string; id?: string },
  ) => {
    setFolders((prev) => {
      const updated = [...prev]
      const sourceFolder = updated.find((f) => f.id === source.folderId)
      const targetFolder = updated.find((f) => f.id === target.folderId)
      if (!sourceFolder || !targetFolder) return prev
      const fromIdx = sourceFolder.groups.findIndex((g) => g.id === source.id)
      if (fromIdx === -1) return prev
      const [moved] = sourceFolder.groups.splice(fromIdx, 1)
      let toIdx = targetFolder.groups.findIndex((g) => g.id === target.id)
      if (toIdx === -1) toIdx = targetFolder.groups.length
      targetFolder.groups.splice(toIdx, 0, moved)
      saveFolderSettings(updated)
      return updated
    })
    setDragGroup(null)

    try {
      const group = groups.find((g) => g.id === source.id)
      const folderName =
        folders.find((f) => f.id === target.folderId)?.name || target.folderId
      const criteria = {
        ...(group?.criteria || {}),
        folder: target.folderId,
        folderName,
      }
      await updateGroup(source.id, { criteria })
      toast.success("Group moved")
      log("info", "Group moved", { id: source.id, to: target.folderId })
    } catch (err) {
      log("error", "Failed to move group", { error: err })
      toast.error("Failed to move group. Please try again.")
    } finally {
      await loadGroups()
    }
  }

  const ICON_COMPONENTS: Record<IconValue, React.ElementType> = {
    "users": Users,
    "star": Star,
    "zap": Zap,
    "dollar-sign": DollarSign,
    "trending-up": TrendingUp,
    "home": Home,
    "building": Building,
    "clipboard-list": ClipboardList,
    "file-text": FileText,
    "user-x": UserX,
  }

  const getGroupIcon = (group: Group) => {
    const iconVal = group.criteria?.icon as IconValue | undefined
    const color = group.color || "#F0303A"

    if (iconVal && ICON_COMPONENTS[iconVal]) {
      const Icon = ICON_COMPONENTS[iconVal]
      return <Icon className="h-4 w-4" style={{ color }} />
    }

    const name = group.name.toLowerCase()
    if (name.includes("vip")) return <Star className="h-4 w-4" style={{ color }} />
    if (name.includes("hot")) return <Zap className="h-4 w-4" style={{ color }} />
    if (name.includes("high value")) return <DollarSign className="h-4 w-4" style={{ color }} />
    if (name.includes("investor")) return <TrendingUp className="h-4 w-4" style={{ color }} />
    if (name.includes("cash")) return <DollarSign className="h-4 w-4" style={{ color }} />
    if (name.includes("wholesale")) return <Users className="h-4 w-4" style={{ color }} />
    if (name.includes("cold")) return <UserX className="h-4 w-4" style={{ color }} />
    return <Tag className="h-4 w-4" style={{ color }} />
  }

  const filteredFolders = folders
    .map((folder) => ({
      ...folder,
      groups: folder.groups.filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase())),
    }))
    .filter((folder) => folder.groups.length > 0)

  const groupTotal = Object.values(buyerCounts).reduce((a, b) => a + b, 0)
  const totalBuyerCount = typeof totalBuyers === "number" ? totalBuyers : groupTotal
  const filteredBuyerCount = typeof filteredBuyers === "number" ? filteredBuyers : totalBuyerCount
  const activeGroups = groups.length

  return (
    <Card className="sidebar-panel card-shadow sidebar-dark w-64 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Smart groups</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Add new group or folder">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                <Users className="mr-2 h-4 w-4" />
                Create Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreateFolder(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">Organize your buyers</p>

        <div className="relative">
          <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            id="group-search"
            name="group-search"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer ${
              selectedGroupId === "" ? "bg-brand/5 text-foreground" : "hover:bg-muted/60"
            }`}
            style={selectedGroupId === "" ? { boxShadow: "inset 2px 0 0 #F0303A" } : undefined}
            onClick={() => onGroupSelect?.("")}
            title="Show all buyers"
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-sm whitespace-nowrap">All Buyers</span>
            </div>
            <Badge variant="secondary" className="text-xs text-muted-foreground">{totalBuyerCount}</Badge>
          </div>
          {/* One DndContext for the whole sidebar handles BOTH folder reorder
              and within-folder group reorder (nesting DndContext is discouraged;
              nesting SortableContext under a single DndContext is supported). */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredFolders.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredFolders.map((folder) => (
                <SortableFolder
                  key={folder.id}
                  folder={folder}
                  onToggle={() => toggleFolder(folder.id)}
                  onEdit={() => {
                    setEditingFolder(folder)
                    setFolderForm({ name: folder.name })
                    setShowEditFolder(true)
                  }}
                  onAddGroup={() => setShowCreateGroup(true)}
                  onDelete={
                    folder.id !== "priority-segments" &&
                    folder.id !== "buyer-types" &&
                    folder.id !== "custom-groups"
                      ? () => setFolderToDelete(folder)
                      : undefined
                  }
                >
                  <div
                    className="ml-6 space-y-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragGroup) moveGroup(dragGroup, { folderId: folder.id })
                      setDragGroup(null)
                    }}
                  >
                    <SortableContext
                      items={folder.groups.map((g) => g.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {folder.groups.map((group) => (
                        <SortableGroupItem
                          key={group.id}
                          group={group}
                          folderId={folder.id}
                          isSelected={selectedGroupId === group.id}
                          count={buyerCounts[group.id] || 0}
                          icon={getGroupIcon(group)}
                          onSelect={() => onGroupSelect?.(group.id)}
                          onEdit={() => {
                            setEditingGroup(group)
                            setGroupForm({
                              name: group.name,
                              description: group.description || "",
                              type: group.type || "manual",
                              color: group.color || "#F0303A",
                              icon: (group.criteria?.icon as IconValue) || "users",
                              folder: String(group.criteria?.folder || folder.id),
                            })
                          }}
                          onDelete={() => setGroupToDelete(group)}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </SortableFolder>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </CardContent>

      {/* Summary Stats */}
      <div className="p-4 border-t space-y-2 flex-shrink-0">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Buyers:</span>
          <span className="font-medium">{totalBuyerCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Filtered:</span>
          <span className="font-medium">{filteredBuyerCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Active Groups:</span>
          <span className="font-medium">{activeGroups}</span>
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter group name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-description" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="group-description"
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter group description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-folder" className="text-xs text-muted-foreground">Parent folder</Label>
              <Select
                value={groupForm.folder}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, folder: value }))}
              >
                <SelectTrigger id="group-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Icon color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    aria-label={`Color ${opt.label}`}
                    onClick={() => setGroupForm((prev) => ({ ...prev, color: opt.value as ColorValue }))}
                    className={`h-7 w-7 rounded-md ${groupForm.color === opt.value ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : ""}`}
                    style={{ backgroundColor: opt.value }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Icon</Label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = groupForm.icon === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      aria-label={`Icon ${opt.label}`}
                      onClick={() => setGroupForm((prev) => ({ ...prev, icon: opt.value }))}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border ${active ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateGroup(false)}>
                Cancel
              </Button>
              <Button variant="brand" onClick={handleCreateGroup}>Create group</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="edit-group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter group name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-description" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="edit-group-description"
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter group description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-folder" className="text-xs text-muted-foreground">Parent folder</Label>
              <Select
                value={groupForm.folder}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, folder: value }))}
              >
                <SelectTrigger id="edit-group-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Icon color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    aria-label={`Color ${opt.label}`}
                    onClick={() => setGroupForm((prev) => ({ ...prev, color: opt.value as ColorValue }))}
                    className={`h-7 w-7 rounded-md ${groupForm.color === opt.value ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : ""}`}
                    style={{ backgroundColor: opt.value }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Icon</Label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = groupForm.icon === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      aria-label={`Icon ${opt.label}`}
                      onClick={() => setGroupForm((prev) => ({ ...prev, icon: opt.value }))}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border ${active ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditingGroup(null)}>
                Cancel
              </Button>
              <Button variant="brand" onClick={handleEditGroup}>Save changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter folder name"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateFolder(false)}>
                Cancel
              </Button>
              <Button variant="brand" onClick={handleCreateFolder}>Create folder</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={showEditFolder} onOpenChange={setShowEditFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-folder-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="edit-folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter folder name"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowEditFolder(false)}>
                Cancel
              </Button>
              <Button variant="brand" onClick={handleEditFolder}>Save changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmInputDialog
        open={!!groupToDelete}
        onOpenChange={(o) => !o && setGroupToDelete(null)}
        title="Delete Group"
        description="This action cannot be undone."
        confirmationText="delete this group"
        actionText="Delete"
        onConfirm={handleDeleteGroup}
      />

      <ConfirmInputDialog
        open={!!folderToDelete}
        onOpenChange={(o) => !o && setFolderToDelete(null)}
        title="Delete Folder"
        description="Groups will be moved to Custom Groups."
        confirmationText="Delete this Group Folder"
        actionText="Delete"
        onConfirm={handleDeleteFolder}
      />
    </Card>
  )
}
