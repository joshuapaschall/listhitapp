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
import SendFoxContactsViewer from "./sendfox-contacts-viewer" // Modal viewer for SendFox contacts
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
} from "lucide-react"

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
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)
  const [dragGroup, setDragGroup] = useState<{ id: string; folderId: string } | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<GroupFolder | null>(null)
  const [viewListId, setViewListId] = useState<number | null>(null)
  const [showContacts, setShowContacts] = useState(false)

  // Form states
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    type: "manual",
    color: "#3B82F6",
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
      { id: "engagement-status", name: "Engagement Status", groups: [], expanded: false },
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
      const folderId = group.criteria?.folder || "custom-groups"
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
      setGroupForm({ name: "", description: "", type: "manual", color: "#3B82F6", icon: "users", folder: "" })
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
      setGroupForm({ name: "", description: "", type: "manual", color: "#3B82F6", icon: "users", folder: "" })
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

  const moveFolder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setFolders((prev) => {
      const updated = [...prev]
      const fromIdx = updated.findIndex((f) => f.id === sourceId)
      const toIdx = updated.findIndex((f) => f.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = updated.splice(fromIdx, 1)
      updated.splice(toIdx, 0, moved)
      saveFolderSettings(updated)
      return updated
    })
    setDragFolderId(null)
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
    const color = group.color || "#3B82F6"

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
    return <Users className="h-4 w-4" style={{ color }} />
  }

  const filteredFolders = folders
    .map((folder) => ({
      ...folder,
      groups: folder.groups.filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase())),
    }))
    .filter((folder) => folder.groups.length > 0 || searchQuery === "")

  const groupTotal = Object.values(buyerCounts).reduce((a, b) => a + b, 0)
  const totalBuyerCount = typeof totalBuyers === "number" ? totalBuyers : groupTotal
  const filteredBuyerCount = typeof filteredBuyers === "number" ? filteredBuyers : totalBuyerCount
  const activeGroups = groups.length

  return (
    <Card className="sidebar-panel card-shadow sidebar-dark w-64 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Smart Groups</CardTitle>
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
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="group-search"
            name="group-search"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer ${
              selectedGroupId === "" ? "bg-muted" : ""
            }`}
            onClick={() => onGroupSelect?.("")}
            title="Show all buyers"
          >
            <div className="flex items-center space-x-2 flex-1">
              <Users className="h-4 w-4" />
              <span className="text-xs whitespace-nowrap">All Buyers</span>
            </div>
            <Badge variant="secondary" className="text-xs">{totalBuyerCount}</Badge>
          </div>
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="space-y-1"
              draggable
              onDragStart={() => setDragFolderId(folder.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFolderId) moveFolder(dragFolderId, folder.id)
                setDragFolderId(null)
              }}
            >
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start p-2 h-auto"
                  onClick={() => toggleFolder(folder.id)}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Folder options">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingFolder(folder)
                        setFolderForm({ name: folder.name })
                        setShowEditFolder(true)
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Group to Folder
                    </DropdownMenuItem>
                    {folder.id !== "priority-segments" &&
                      folder.id !== "buyer-types" &&
                      folder.id !== "engagement-status" &&
                      folder.id !== "custom-groups" && (
                        <DropdownMenuItem onClick={() => setFolderToDelete(folder)} className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Folder
                        </DropdownMenuItem>
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {folder.expanded && (
                <div
                  className="ml-6 space-y-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragGroup) moveGroup(dragGroup, { folderId: folder.id })
                    setDragGroup(null)
                  }}
                >
                  {folder.groups.map((group) => (
                    <div
                      key={group.id}
                      className={`flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer ${
                        selectedGroupId === group.id ? "bg-muted" : ""
                      }`}
                      onClick={() => onGroupSelect?.(group.id)}
                      title={`Select ${group.name} group`}
                      draggable
                      onDragStart={() => setDragGroup({ id: group.id, folderId: folder.id })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragGroup) moveGroup(dragGroup, { id: group.id, folderId: folder.id })
                        setDragGroup(null)
                      }}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {getGroupIcon(group)}
                        <span className="text-xs whitespace-nowrap">{group.name}</span>
                        {Boolean(group.sendfox_list_id) && (
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            🔗 Synced to SendFox ({group.name})
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Badge variant="secondary" className="text-xs">
                          {buyerCounts[group.id] || 0}
                        </Badge>
                        {/* Render the SendFox contacts viewer button only when this group has a linked SendFox list */}
                        {Boolean(group.sendfox_list_id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Open SendFoxContactsViewer for this list
                              setViewListId(group.sendfox_list_id)
                              setShowContacts(true)
                            }}
                          >
                            👁 View Contacts
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Group options">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingGroup(group)
                                setGroupForm({
                                  name: group.name,
                                  description: group.description || "",
                                  type: group.type,
                                  color: group.color || "#3B82F6",
                                  icon: (group.criteria?.icon as IconValue) || "users",
                                  folder: group.criteria?.folder || folder.id,
                                })
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setGroupToDelete(group)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter group name"
              />
            </div>
            <div>
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter group description"
              />
            </div>
            <div>
              <Label htmlFor="group-folder">Parent Folder</Label>
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
            <div>
              <Label htmlFor="group-color">Icon Color</Label>
              <Select
                value={groupForm.color}
                onValueChange={(value) =>
                  setGroupForm((prev) => ({ ...prev, color: value as ColorValue }))
                }
              >
                <SelectTrigger id="group-color">
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: opt.value }}
                      />
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="group-icon">Icon</Label>
              <Select
                value={groupForm.icon}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, icon: value as IconValue }))}
              >
                <SelectTrigger id="group-icon">
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" /> {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateGroup(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup}>Create Group</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter group name"
              />
            </div>
            <div>
              <Label htmlFor="edit-group-description">Description</Label>
              <Textarea
                id="edit-group-description"
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter group description"
              />
            </div>
            <div>
              <Label htmlFor="edit-group-folder">Parent Folder</Label>
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
            <div>
              <Label htmlFor="edit-group-color">Icon Color</Label>
              <Select
                value={groupForm.color}
                onValueChange={(value) =>
                  setGroupForm((prev) => ({ ...prev, color: value as ColorValue }))
                }
              >
                <SelectTrigger id="edit-group-color">
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: opt.value }}
                      />
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-group-icon">Icon</Label>
              <Select
                value={groupForm.icon}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, icon: value as IconValue }))}
              >
                <SelectTrigger id="edit-group-icon">
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" /> {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGroup(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditGroup}>Save Changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter folder name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create Folder</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={showEditFolder} onOpenChange={setShowEditFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-folder-name">Folder Name</Label>
              <Input
                id="edit-folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter folder name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditFolder(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditFolder}>Save Changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <SendFoxContactsViewer
        listId={viewListId ?? undefined}
        open={showContacts}
        onOpenChange={(o) => {
          setShowContacts(o)
          if (!o) setViewListId(null)
        }}
      />

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
