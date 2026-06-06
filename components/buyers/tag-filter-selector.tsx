"use client"

import type React from "react"
import { useState } from "react"
import { Check, X, Tag as TagIcon, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

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
  placeholder = "Search tags...",
  variant = "include",
}: TagFilterSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const [open, setOpen] = useState(false)
  const isExclude = variant === "exclude"

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchValue.toLowerCase()),
  )

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

  return (
    <div className="relative space-y-2">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        {selectedTags.map((tagName) => (
          <span key={tagName} className={cn("chip", isExclude && "chip-exclude")}>
            {isExclude ? <Ban className="h-3 w-3" /> : <TagIcon className="h-3 w-3" />}
            {tagName}
            <X className="h-3 w-3 cursor-pointer" onClick={(e) => removeTag(tagName, e)} />
          </span>
        ))}
        <Command className="w-full relative overflow-visible" shouldFilter={false}>
          <CommandInput
            placeholder={selectedTags.length ? "" : placeholder}
            value={searchValue}
            onValueChange={setSearchValue}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(true)}
            className="border-0 focus:ring-0 p-0 h-8"
          />
          {open && (
            <div className="absolute left-0 top-full z-50 w-full bg-popover border rounded-md shadow-md mt-1">
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
                      <span>{tag.name}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedTags.includes(tag.name) ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          )}
        </Command>
      </div>
    </div>
  )
}
