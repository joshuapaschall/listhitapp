"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import CreateUserModal from "./create-user-modal"
import DeleteUserModal from "./delete-user-modal"

export interface UserRow {
  id: string
  email: string
  created_at: string
  profiles: { role: string } | null
}

interface UsersClientProps {
  rows: UserRow[]
}

export default function UsersClient({ rows }: UsersClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteEmail, setDeleteEmail] = useState<string>("")

  const handleCreated = () => {
    window.location.reload()
  }
  const handleDeleted = () => {
    window.location.reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={() => setShowCreate(true)}>Create User</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.email}</TableCell>
              <TableCell>
                <Select
                  value={row.profiles?.role || "user"}
                  onValueChange={async (val) => {
                    await fetch("/api/admin/update-role", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: row.id, role: val }),
                    })
                    window.location.reload()
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteId(row.id)
                    setDeleteEmail(row.email)
                  }}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CreateUserModal open={showCreate} onOpenChange={setShowCreate} onSuccess={handleCreated} />
      {deleteId && (
        <DeleteUserModal
          open={!!deleteId}
          onOpenChange={(o) => {
            if (!o) setDeleteId(null)
          }}
          userId={deleteId}
          email={deleteEmail}
          onSuccess={handleDeleted}
        />
      )}
    </div>
  )
}
