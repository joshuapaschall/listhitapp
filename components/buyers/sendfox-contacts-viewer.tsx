"use client"

import React, { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"

interface SendFoxContact {
  id: number
  email: string
  first_name?: string
  last_name?: string
  status?: string
  created_at?: string
}

interface SendFoxContactsViewerProps {
  listId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SendFoxContactsViewer({
  listId,
  open,
  onOpenChange,
}: SendFoxContactsViewerProps) {
  const [contacts, setContacts] = useState<SendFoxContact[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && listId) {
      setLoading(true)
      fetch(`/api/sendfox/lists/${listId}/contacts`)
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text())
          return res.json()
        })
        .then((data) => setContacts(data || []))
        .catch((err) => {
          toast({
            variant: "destructive",
            title: "Failed to load SendFox contacts",
            description: err instanceof Error ? err.message : "An unexpected error occurred",
          })
          setContacts([])
        })
        .finally(() => setLoading(false))
    }
  }, [open, listId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Contacts</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full">
          <div className="p-6">
            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loading && contacts.length === 0 && (
              <p className="text-sm text-muted-foreground">No contacts found.</p>
            )}
            {!loading && contacts.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">{c.email}</td>
                      <td className="py-2">
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="py-2 capitalize">{c.status || ""}</td>
                      <td className="py-2">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString()
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
