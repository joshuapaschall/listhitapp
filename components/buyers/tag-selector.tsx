"use client"

import type React from "react"
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
import { supabase } from "@/lib/supabase"

interface Tag {
  id: string
  name: string
  color?: string
  is_protected?: boolean
}

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
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) fetchTags()
  }, [open])

  const finalPlaceholder = allowCreate ? placeholder : "Search tags..."

  const fetchTags = async (searchTerm = "") => {
    setIsLoading(true)
    try {
      let query = supabase.from("tags").select("id, name, color, is_protected")

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`)
      }

      const { data, error } = await query.order("name")
      if (error) throw error
      setTags(data || [])
    } catch (err) {
      console.error("Error fetching tags:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const createTag = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert([{ name: name.trim() }])
        .select()
      if (error) throw error
      if (data && data[0]) {
        setTags([...tags, data[0]])
        onChange([...value, data[0].name])
        setInputValue("")
      }
    } catch (err) {
      console.error("Error creating tag:", err)
    }
  }

  const toggleTag = (tag: Tag) => {
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
    if (input.length > 1) fetchTags(input)
  }

  const handleCreate = () => {
    if (allowCreate && inputValue.trim()) createTag(inputValue)
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
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted"
                        onClick={handleCreate}
                      >
                        <span>
                          Create &quot;{inputValue}&quot;
                        </span>
                        <Badge variant="outline">Enter</Badge>
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