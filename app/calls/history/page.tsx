'use client';

import { useState, useEffect } from 'react';
import { CallHistoryTable } from '@/components/calls/CallHistoryTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  
  // Filter states
  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState('');
  const [direction, setDirection] = useState('all');
  const [hasRecording, setHasRecording] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState('started_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const { toast } = useToast();

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        ...(search && { search }),
        ...(agentId && { agentId }),
        ...(direction && direction !== 'all' && { direction }),
        ...(hasRecording && hasRecording !== 'all' && { hasRecording }),
        ...(dateFrom && { dateFrom: dateFrom.toISOString() }),
        ...(dateTo && { dateTo: dateTo.toISOString() }),
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/calls/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calls');
      
      const data = await response.json();
      setCalls(data.calls);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [pagination.page, pagination.pageSize, sortBy, sortOrder]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCalls();
  };

  const handleReset = () => {
    setSearch('');
    setAgentId('');
    setDirection('all');
    setHasRecording('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('started_at');
    setSortOrder('desc');
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCalls();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(agentId && { agentId }),
        ...(direction && direction !== 'all' && { direction }),
        ...(hasRecording && hasRecording !== 'all' && { hasRecording }),
        ...(dateFrom && { dateFrom: dateFrom.toISOString() }),
        ...(dateTo && { dateTo: dateTo.toISOString() }),
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/calls/export?${params}`);
      if (!response.ok) throw new Error('Failed to export calls');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-history-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Call history exported successfully'
      });
    } catch (error) {
      console.error('Error exporting calls:', error);
      toast({
        title: 'Error',
        description: 'Failed to export call history',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-muted-foreground">
            View and manage all call recordings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchCalls()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Phone number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger>
                  <SelectValue placeholder="All directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Has Recording */}
            <div className="space-y-2">
              <Label>Recording</Label>
              <Select value={hasRecording} onValueChange={setHasRecording}>
                <SelectTrigger>
                  <SelectValue placeholder="All calls" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">With Recording</SelectItem>
                  <SelectItem value="false">No Recording</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePicker
                date={dateFrom}
                setDate={setDateFrom}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePicker
                date={dateTo}
                setDate={setDateTo}
              />
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="started_at">Date</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="from_agent_id">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label>Order</Label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Call Records
          </CardTitle>
          <CardDescription>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <CallHistoryTable calls={calls} />
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={!pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
