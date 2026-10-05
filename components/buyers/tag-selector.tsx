"use client"

import type React from "react"
import { useMemo, useState } from "react"
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
import { toast } from "sonner"
import { useOrgTags, useInvalidateTagViews, type OrgTag } from "@/hooks/use-org-tags"

interface TagSelectorProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Allow creating new tags when the search yields no results */
  allowCreate?: boolean
}

export default function TagSelector({
  value = [],
  onChange,
  placeholder = "Search or create tags...",
  disabled = false,
  allowCreate = true,
}: TagSelectorProps) {
  // One shared read of the org vocabulary; filtering is client-side so typing
  // doesn't round-trip and a rename elsewhere shows up after one invalidation.
  const { data: allTags, isLoading } = useOrgTags()
  const invalidateTagViews = useInvalidateTagViews()
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const finalPlaceholder = allowCreate ? placeholder : "Search tags..."

  const tags = useMemo(() => {
    const list = allTags ?? []
    const term = inputValue.trim().toLowerCase()
    if (!term) return list
    return list.filter((tag) => tag.name.toLowerCase().includes(term))
  }, [allTags, inputValue])

  const createTag = async (name: string) => {
    if (isCreating) return
    setIsCreating(true)
    try {
      // The server owns tag creation. It matches case-insensitively and returns
      // the CANONICAL name, so typing "atlanta closers" when "Atlanta Closers"
      // exists selects the existing tag instead of making a near-duplicate.
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Couldn't create tag")

      const canonical = body?.tag?.name as string | undefined
      if (canonical) {
        if (!value.includes(canonical)) onChange([...value, canonical])
        setInputValue("")
        await invalidateTagViews()
      }
    } catch (err) {
      console.error("Error creating tag:", err)
      toast.error(err instanceof Error ? err.message : "Couldn't create tag")
    } finally {
      setIsCreating(false)
    }
  }

  const toggleTag = (tag: OrgTag) => {
    const isSelected = value.includes(tag.name)
    if (isSelected) {
      onChange(value.filter((t) => t !== tag.name))
    } else {
      onChange([...value, tag.name])
    }
  }

  const removeTag = (tagName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((t) => t !== tagName))
  }

  const handleInputChange = (input: string) => {
    setInputValue(input)
  }

  const handleCreate = () => {
    if (allowCreate && !isCreating && inputValue.trim()) createTag(inputValue)
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        {value.map((tag, index) => (
          <Badge
            key={`selected-${tag}-${index}`}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1"
          >
            {tag}
            <X className="h-3 w-3 cursor-pointer" onClick={(e) => removeTag(tag, e)} />
          </Badge>
        ))}

        <Command className="w-full">
          <CommandInput
            placeholder={value.length ? "" : finalPlaceholder}
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
                  <span className="ml-2">Loading tags...</span>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {inputValue.trim() && allowCreate ? (
                      <div
                        aria-disabled={isCreating}
                        className={`flex items-center justify-between p-2 ${
                          isCreating ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
                        }`}
                        onClick={handleCreate}
                      >
                        <span>
                          Create &quot;{inputValue}&quot;
                        </span>
                        {isCreating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Badge variant="outline">Enter</Badge>
                        )}
                      </div>
                    ) : (
                      <div className="p-2">No tags found</div>
                    )}
                  </CommandEmpty>

                  <CommandGroup>
                    {tags.map((tag) => {
                      const isSelected = value.includes(tag.name)
                      return (
                        <CommandItem
                          key={`available-${tag.id}`}
                          onSelect={() => toggleTag(tag)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: tag.color || "#3B82F6" }}
                            />
                            <span>{tag.name}</span>
                            {tag.is_protected && (
                              <Badge variant="outline" className="ml-2 text-xs">Protected</Badge>
                            )}
                          </div>
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