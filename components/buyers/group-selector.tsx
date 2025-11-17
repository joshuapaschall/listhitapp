"use client"

import { useState, useEffect } from "react"
import { X, Check, Loader2 } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { getGroups, createGroup, Group } from "@/lib/group-service"

interface GroupSelectorProps {
  value: string[]
  onChange: (groups: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export default function GroupSelector({
  value = [],
  onChange,
  placeholder = "Search or create groups...",
  disabled = false,
}: GroupSelectorProps) {
  const [inputValue, setInputValue] = useState("")
  const [groups, setGroups] = useState<Group[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) fetchGroups()
  }, [open])

  const fetchGroups = async (searchTerm = "") => {
    setIsLoading(true)
    try {
      const data = await getGroups()
      const filtered = searchTerm
        ? data.filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : data
      setGroups(filtered)
    } catch (err) {
      console.error("Error fetching groups:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (input: string) => {
    setInputValue(input)
    if (input.length > 1) fetchGroups(input)
  }

  const createNewGroup = async (name: string) => {
    try {
      const newGroup = await createGroup({ name })
      if (newGroup) {
        setGroups([...groups, newGroup])
        onChange([...value, newGroup.id])
        setInputValue("")
      }
    } catch (err) {
      console.error("Error creating group:", err)
    }
  }

  const toggleGroup = (group: Group) => {
    const selected = value.includes(group.id)
    if (selected) {
      onChange(value.filter((id) => id !== group.id))
    } else {
      onChange([...value, group.id])
    }
  }

  const removeGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((g) => g !== id))
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        {value.map((id) => {
          const group = groups.find((g) => g.id === id)
          const label = group?.name || id
          return (
            <Badge
              key={id}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              {label}
              <X className="h-3 w-3 cursor-pointer" onClick={(e) => removeGroup(id, e)} />
            </Badge>
          )
        })}

        <Command className="w-full">
          <CommandInput
            placeholder={value.length ? "" : placeholder}
            value={inputValue}
            onValueChange={handleInputChange}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(true)}
            className="border-0 focus:ring-0 p-0 h-8"
          />

          {open && (
            <CommandList className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-52 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Loading groups...</span>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {inputValue.trim() ? (
                      <div
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted"
                        onClick={() => createNewGroup(inputValue)}
                      >
                        <span>Create "{inputValue}"</span>
                        <Badge variant="outline">Enter</Badge>
                      </div>
                    ) : (
                      <div className="p-2">No groups found</div>
                    )}
                  </CommandEmpty>

                  <CommandGroup>
                    {groups.map((group) => {
                      const isSelected = value.includes(group.id)
                      return (
                        <CommandItem
                          key={group.id}
                          onSelect={() => toggleGroup(group)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <span>{group.name}</span>
                          {isSelected && <Check className="h-4 w-4" />}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          )}
        </Command>
      </div>
    </div>
  )
}