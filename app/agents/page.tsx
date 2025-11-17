"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Circle,
  Loader2,
  Trash2,
  Phone,
  Clock,
  Activity,
  Settings,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  Edit,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || ""
  if (!res.ok) {
    if (ct.includes("text/html")) {
      throw new Error(
        "This preview is protected by Vercel. Use the Production URL or sign in.",
      )
    }
    try {
      const b = await res.json()
      throw new Error(b?.error || `HTTP ${res.status}`)
    } catch {
      throw new Error(`HTTP ${res.status}`)
    }
  }
  if (ct.includes("text/html")) {
    throw new Error(
      "This preview is protected by Vercel. Use the Production URL or sign in.",
    )
  }
  return res.json()
}

interface Agent {
  id: string;
  email: string;
  display_name: string;
  status: 'available' | 'busy' | 'offline' | 'break';
  created_at: string;
  last_call_at?: string | null;
  sip_username?: string | null; // ← standardized
  calls_today?: number;
  avg_call_duration?: number;
  total_calls?: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    email: '',
    password: '',
    display_name: '',
    // UI field; we map this to sip_username on the API
    extension: '',
  });

  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAgents(true);
    const interval = setInterval(() => fetchAgents(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async (force: boolean) => {
    try {
      const res = await fetch(`/api/agents/list?ts=${force ? Date.now() : ""}`, {
        cache: "no-store", // ← kill 304/ETag reuse
      });
      const data = await safeJson(res);
      setAgents(data || []);
    } catch (err: any) {
      console.error("Failed to fetch agents:", err);
      toast.error(err.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgent.email || !newAgent.password) {
      toast.error("Please enter email and password");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        email: newAgent.email,
        password: newAgent.password,
        display_name: newAgent.display_name,
        sip_username: newAgent.extension || undefined,
      };

      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const json: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(json?.error || `Request failed (${res.status})`);
        return;
      }

      toast.success("Agent created successfully");
      setShowCreateDialog(false);
      setNewAgent({ email: "", password: "", display_name: "", extension: "" });
      await fetchAgents(true);
    } catch (err: any) {
      console.error("Failed to create agent:", err);
      toast.error(err.message || "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteAgent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${deleteAgent.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      await safeJson(res)
      toast.success('Agent deleted successfully')
      setDeleteAgent(null)
      await fetchAgents(true)
    } catch (err: any) {
      console.error('Failed to delete agent:', err)
      toast.error(err.message || 'Failed to delete agent')
    } finally {
      setDeleting(false)
    }
  };

  const handleStatusChange = async (agentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        cache: 'no-store',
      })
      await safeJson(res)
      toast.success('Status updated')
      await fetchAgents(true)
    } catch (err: any) {
      console.error('Failed to update status:', err)
      toast.error(err.message || 'Failed to update status')
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-red-500';
      case 'break':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      available: 'default',
      busy: 'destructive',
      break: 'warning',
      offline: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="font-normal capitalize">
        <Circle className={cn('h-2 w-2 mr-1 fill-current', getStatusColor(status))} />
        {status}
      </Badge>
    );
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      agent.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: agents.length,
    available: agents.filter((a) => a.status === 'available').length,
    busy: agents.filter((a) => a.status === 'busy').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  };

  return (
    <>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage call center agents and monitor their status
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAgents(true)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Agents
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Available
                </CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Busy
                </CardTitle>
                <Phone className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.busy}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Offline
                </CardTitle>
                <UserX className="h-4 w-4 text-gray-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.offline}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            {/* Filters */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    Search & Filter
                  </CardTitle>
                  <Badge variant="secondary" className="font-normal">
                    {filteredAgents.length} agents
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="break">On Break</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Loading agents...</p>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No agents found</p>
                    <p className="text-sm">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Click "Add Agent" to create your first agent'}
                    </p>
                  </div>
                ) : (
                  <div className="w-full overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Agent</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Extension</TableHead>
                          <TableHead>Last Call</TableHead>
                          <TableHead>Calls Today</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAgents.map((agent) => (
                          <TableRow key={agent.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {agent.display_name || agent.email}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Select
                                value={agent.status}
                                onValueChange={(value) => handleStatusChange(agent.id, value)}
                              >
                                <SelectTrigger className="w-[120px] h-8 border-0">
                                  <SelectValue>{getStatusBadge(agent.status)}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="available">Available</SelectItem>
                                  <SelectItem value="busy">Busy</SelectItem>
                                  <SelectItem value="break">On Break</SelectItem>
                                  <SelectItem value="offline">Offline</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell>
                              <span className="font-mono text-sm">
                                {agent.sip_username || '-'}
                              </span>
                            </TableCell>

                            <TableCell>
                              {agent.last_call_at ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(agent.last_call_at), 'h:mm a')}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>

                            <TableCell>
                              <span className="text-sm font-medium">{agent.calls_today || 0}</span>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(agent.created_at), 'MMM d, yyyy')}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditAgent(agent)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteAgent(agent)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Agent Performance Metrics</CardTitle>
                <CardDescription>Monitor agent productivity and call statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Performance Dashboard Coming Soon</p>
                  <p className="text-sm mt-2">Track call duration, handle time, and quality metrics</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Agent Settings</CardTitle>
                <CardDescription>Configure agent permissions and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Settings Panel Coming Soon</p>
                  <p className="text-sm mt-2">Manage skills, queues, and routing preferences</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>Add a new agent to the call center</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@example.com"
                value={newAgent.email}
                onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                placeholder="John Doe"
                value={newAgent.display_name}
                onChange={(e) => setNewAgent({ ...newAgent, display_name: e.target.value })}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extension">SIP Username (Optional)</Label>
              <Input
                id="extension"
                placeholder="e.g. 1001"
                value={newAgent.extension}
                onChange={(e) => setNewAgent({ ...newAgent, extension: e.target.value })}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newAgent.password}
                onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateAgent} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Agent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Dialog */}
      <AlertDialog open={!!deleteAgent} onOpenChange={(open) => !open && setDeleteAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteAgent?.display_name || deleteAgent?.email}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
