"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ChevronDown, ChevronRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Group } from "@/lib/supabase"
import { getGroups, createGroup } from "@/lib/group-service"
import { BuyerService } from "@/services/buyer-service"

interface GroupTreeSelectorProps {
  value: string[]
  onChange: (ids: string[]) => void
  allowCreate?: boolean
  /** "premium" renders the campaign "To" step look: emerald-tint selected rows,
   *  filled checks, right-aligned muted counts. Default keeps the checkbox tree. */
  variant?: "default" | "premium"
}

interface StoredFolder {
  id: string
  name: string
  expanded?: boolean
  order?: number
  groupOrder?: string[]
}

interface GroupFolder {
  id: string
  name: string
  groups: Group[]
  expanded: boolean
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

export default function GroupTreeSelector({ value, onChange, allowCreate = true, variant = "default" }: GroupTreeSelectorProps) {
  const premium = variant === "premium"
  const [folders, setFolders] = useState<GroupFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [buyerCounts, setBuyerCounts] = useState<Record<string, number>>({})

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupFolder, setNewGroupFolder] = useState("")
  const [newFolderName, setNewFolderName] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const groups = await getGroups()
      const counts = await BuyerService.getBuyerCountsByGroup()
      organizeFolders(groups)
      setBuyerCounts(counts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const organizeFolders = (groupsData: Group[]) => {
    const saved = loadFolderSettings()

    const baseFolders: GroupFolder[] = [
      { id: "priority-segments", name: "Priority Segments", groups: [], expanded: true },
      { id: "buyer-types", name: "Buyer Types", groups: [], expanded: true },
      { id: "engagement-status", name: "Engagement Status", groups: [], expanded: false },
      { id: "custom-groups", name: "Custom Groups", groups: [], expanded: true },
    ]

    saved.forEach((sf) => {
      const existing = baseFolders.find((f) => f.id === sf.id)
      if (existing) {
        existing.name = sf.name
        if (typeof sf.expanded === "boolean") existing.expanded = sf.expanded
      } else {
        baseFolders.push({ id: sf.id, name: sf.name, groups: [], expanded: sf.expanded ?? true })
      }
    })

    groupsData.forEach((group) => {
      const folderId = String(group.criteria?.folder || "custom-groups")
      const folderName = String(group.criteria?.folderName || folderId)
      let folder = baseFolders.find((f) => f.id === folderId)
      if (!folder) {
        folder = { id: folderId, name: folderName, groups: [], expanded: true }
        baseFolders.push(folder)
      } else if (!saved.find((sf) => sf.id === folderId)) {
        // If folder exists but not saved, ensure it has a readable name
        folder.name = folderName
      }
      folder.groups.push(group)
    })

    // Apply saved ordering to groups within folders
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

    // Sort folders based on saved order
    baseFolders.sort((a, b) => {
      const aOrder = saved.find((sf) => sf.id === a.id)?.order ?? 0
      const bOrder = saved.find((sf) => sf.id === b.id)?.order ?? 0
      return aOrder - bOrder
    })

    setFolders(baseFolders)
    saveFolderSettings(baseFolders)
  }

  const toggleFolder = (id: string) => {
    setFolders((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f))
      saveFolderSettings(updated)
      return updated
    })
  }

  const toggleGroup = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((g) => g !== id))
    } else {
      onChange([...value, id])
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const folderId = newGroupFolder || "custom-groups"
      const folderName = folders.find((f) => f.id === folderId)?.name || folderId
      const created = await createGroup({
        name: newGroupName.trim(),
        description: "",
        type: "manual",
        color: "#3B82F6",
        criteria: { folder: folderId, folderName },
      })

      if (created) {
        onChange([...value, created.id])
      }

      setNewGroupName("")
      setShowCreateGroup(false)
      fetchData()
    } catch (err) {
      console.error("Error creating group:", err)
    }
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    const newFolder: GroupFolder = {
      id: `custom-${Date.now()}`,
      name: newFolderName.trim(),
      groups: [],
      expanded: true,
    }
    const updated = [...folders, newFolder]
    setFolders(updated)
    saveFolderSettings(updated)
    setNewFolderName("")
    setShowCreateFolder(false)
  }

  if (premium) {
    return (
      <div className="space-y-1">
        {folders.map((folder) => (
          <div key={folder.id} className="space-y-0.5">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/40"
              onClick={() => toggleFolder(folder.id)}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {folder.expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {folder.name}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{folder.groups.length}</span>
            </button>
            {folder.expanded && (
              <div className="space-y-0.5 pl-2">
                {folder.groups.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-muted-foreground">No groups here yet.</p>
                ) : (
                  folder.groups.map((group) => {
                    const selected = value.includes(group.id)
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                              selected
                                ? "bg-emerald-600 text-white"
                                : "border border-muted-foreground/40",
                            )}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{group.name}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {buyerCounts[group.id] || 0}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        ))}

        {allowCreate && (
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-1.5 px-1 pt-2 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400"
          >
            <Plus className="h-4 w-4" /> New group
          </button>
        )}

        {allowCreate && (
          <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  id="new-group-name-premium"
                  name="new-group-name-premium"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <Select value={newGroupFolder} onValueChange={setNewGroupFolder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Folder" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateGroup(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroup}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <div key={folder.id}>
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium"
            onClick={() => toggleFolder(folder.id)}
          >
            {folder.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {folder.name}
          </button>
          {folder.expanded && (
            <div className="ml-6 mt-1 space-y-1">
              {folder.groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={value.includes(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <span className="flex items-center gap-1">
                    {group.name}
                    <Badge variant="secondary" className="text-xs">
                      {buyerCounts[group.id] || 0}
                    </Badge>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {allowCreate && (
        <div className="flex gap-2 pt-2">
          <Button type="button" size="sm" onClick={() => setShowCreateGroup(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Group
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowCreateFolder(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Folder
          </Button>
        </div>
      )}

      {allowCreate && (
        <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
          <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              id="new-group-name"
              name="new-group-name"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <Select value={newGroupFolder} onValueChange={setNewGroupFolder}>
              <SelectTrigger>
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>Create</Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {allowCreate && (
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              id="new-folder-name"
              name="new-folder-name"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
