"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DomainService } from "@/services/domain-service"

export default function DomainsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => DomainService.listDomains(),
  })
  const domains = data || []
  const [hostname, setHostname] = useState("")
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hostname.trim()) return
    setAdding(true)
    try {
      await DomainService.addDomain(hostname.trim())
      setHostname("")
      queryClient.invalidateQueries({ queryKey: ["domains"] })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this domain?")) return
    setDeleting(id)
    try {
      await DomainService.deleteDomain(id)
      queryClient.invalidateQueries({ queryKey: ["domains"] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Short Domains</h1>
        <form onSubmit={handleAdd} className="flex items-center space-x-2">
          <Input
            id="domain-hostname"
            name="domain-hostname"
            placeholder="example.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
          <Button type="submit" disabled={!hostname.trim() || adding}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </form>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={2}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && domains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>No domains found.</TableCell>
                </TableRow>
              )}
              {domains.map((d: any) => {
                const id = d.id || d.domain_id
                const host = d.hostname || d.domain
                return (
                  <TableRow key={id}>
                    <TableCell>{host}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(id)}
                        disabled={deleting === id}
                      >
                        {deleting === id ? "Deleting..." : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  )
}
