"use client"

import type React from "react"
import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface Tag {
  id: string
  name: string
  color?: string
}

interface TagFilterSelectorProps {
  availableTags: Tag[]
  selectedTags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  variant?: "include" | "exclude"
}

export default function TagFilterSelector({
  availableTags,
  selectedTags,
  onChange,
  placeholder = "Select tags...",
  variant = "include",
}: TagFilterSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredTags = availableTags.filter((tag) => tag.name.toLowerCase().includes(searchValue.toLowerCase()))

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter((t) => t !== tagName))
    } else {
      onChange([...selectedTags, tagName])
    }
  }

  const removeTag = (tagName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedTags.filter((t) => t !== tagName))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span>
                {selectedTags.length} tag{selectedTags.length !== 1 ? "s" : ""} selected
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {filteredTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => toggleTag(tag.name)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color || "#3B82F6" }} />
                      <span>{tag.name}</span>
                    </div>
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedTags.includes(tag.name) ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tagName) => {
            const tag = availableTags.find((t) => t.name === tagName)
            return (
              <Badge
                key={tagName}
                variant={variant === "exclude" ? "destructive" : "secondary"}
                className="flex items-center gap-1 px-2 py-1"
                style={
                  variant === "include" && tag?.color
                    ? { backgroundColor: tag.color + "20", color: tag.color }
                    : undefined
                }
              >
                {variant === "exclude" && "NOT "}
                {tagName}
                <X className="h-3 w-3 cursor-pointer" onClick={(e) => removeTag(tagName, e)} />
              </Badge>
            )
          })}
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs">
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
