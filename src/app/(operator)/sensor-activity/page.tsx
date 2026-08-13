'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle, Filter, RotateCcw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { SensorEventCard } from '@/components/sensor/SensorEventCard';
import { useUrlFilters } from '@/lib/use-url-filters';
import type { SensorEventItem } from '@/types/operator-dashboard';

export default function OperatorSensorActivityPage() {
  const [events, setEvents] = useState<SensorEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Persistent URL Filters
  const { filters, setFilter, resetFilters } = useUrlFilters({
    event_type: 'ALL',
    assignment_status: 'ALL',
  });

  const eventTypeFilter = filters.event_type || 'ALL';
  const assignmentFilter = filters.assignment_status || 'ALL';

  // Ref for race-condition tracking
  const requestIdRef = useRef(0);
  const { lastMessage } = useWebSocket();

  const fetchEvents = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setErrorMsg('');

      const params = new URLSearchParams();
      params.set('limit', '100');

      if (eventTypeFilter !== 'ALL') {
        params.set('event_type', eventTypeFilter);
      }
      if (assignmentFilter !== 'ALL') {
        params.set('assignment_status', assignmentFilter);
      }

      const res = await fetch(`/api/sensor-events?${params.toString()}`);
      const result = await res.json();

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!res.ok) {
        throw new Error(result.error?.message || 'Gagal mengambil data sensor events');
      }

      setEvents(result.events || []);
    } catch (err: unknown) {
      if (currentRequestId === requestIdRef.current) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
        setErrorMsg(msg);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [eventTypeFilter, assignmentFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as Record<string, unknown>).type;
      if (
        type === 'sensor.event_received' ||
        type === 'device.heartbeat_received' ||
        type === 'device.status_updated' ||
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        fetchEvents();
      }
    }
  }, [lastMessage, fetchEvents]);

  const isAssignmentDisabled = eventTypeFilter === 'HEARTBEAT' || eventTypeFilter === 'DEVICE_RESTART';
  const isFilterActive = eventTypeFilter !== 'ALL' || assignmentFilter !== 'ALL';

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'DETECTION':
        return 'Deteksi';
      case 'HEARTBEAT':
        return 'Heartbeat';
      case 'DEVICE_RESTART':
        return 'Mulai Ulang Perangkat';
      default:
        return type;
    }
  };

  const getAssignmentLabel = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return 'Terhubung sesi';
      case 'UNASSIGNED':
        return 'Tanpa sesi';
      default:
        return status;
    }
  };

  const getEmptyStateDescription = () => {
    if (eventTypeFilter === 'DETECTION' && assignmentFilter === 'UNASSIGNED') {
      return 'Tidak ada event Deteksi Tanpa Sesi pada jalur ini.';
    }
    if (eventTypeFilter === 'DETECTION' && assignmentFilter === 'ASSIGNED') {
      return 'Tidak ada event Deteksi Terhubung Sesi pada jalur ini.';
    }
    if (eventTypeFilter !== 'ALL') {
      return `Tidak ada event ${getEventLabel(eventTypeFilter)} pada jalur ini.`;
    }
    return 'Belum ada data aktivitas sensor yang terekam pada jalur ini.';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aktivitas Sensor"
        description="Pantau log data sensor realtime untuk memastikan peralatan berjalan normal."
        eyebrow="Operator"
        actions={
          <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-1.5 min-h-[44px] sm:min-h-0">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Filter Toolbar Card */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <span>Filter Log Sensor</span>
            </CardTitle>
            {isFilterActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3.5" />
                <span>Reset Filter</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Event Type Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipe Event</Label>
              <Select value={eventTypeFilter} onValueChange={(val) => setFilter('event_type', val)}>
                <SelectTrigger className="w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder="Pilih Tipe Event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Tipe Event</SelectItem>
                  <SelectItem value="DETECTION">Deteksi (DETECTION)</SelectItem>
                  <SelectItem value="HEARTBEAT">Heartbeat (HEARTBEAT)</SelectItem>
                  <SelectItem value="DEVICE_RESTART">Mulai Ulang Perangkat (DEVICE_RESTART)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Status Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Assignment Sesi {isAssignmentDisabled && '(Khusus Deteksi)'}
              </Label>
              <Select
                value={assignmentFilter}
                onValueChange={(val) => setFilter('assignment_status', val)}
                disabled={isAssignmentDisabled}
              >
                <SelectTrigger className="w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder="Pilih Status Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Assignment</SelectItem>
                  <SelectItem value="ASSIGNED">Terhubung sesi (ASSIGNED)</SelectItem>
                  <SelectItem value="UNASSIGNED">Tanpa sesi (UNASSIGNED)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Context Info */}
            <div className="flex items-end pb-1">
              <p className="text-xs text-muted-foreground">
                * Log otomatis memicu refresh ketika event sensor diterima via WebSocket.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sensor Events Log Card / List */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <span>Log Event Sensor ({events.length} Event)</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">Maksimal 100 event terbaru</span>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {loading && events.length === 0 ? (
            <LoadingState label="Memuat data sensor events" rows={4} />
          ) : events.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Tidak Ada Event Sensor"
              description={getEmptyStateDescription()}
              action={
                isFilterActive ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset Filter
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile View: Card List (< md) */}
              <div className="space-y-3 md:hidden">
                {events.map((evt) => (
                  <SensorEventCard key={evt.id} event={evt} isAdmin={false} />
                ))}
              </div>

              {/* Desktop View: Technical Table (>= md) */}
              <div className="hidden md:block overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs">Waktu Server (Received)</TableHead>
                      <TableHead className="text-xs">Waktu Alat (Device Time)</TableHead>
                      <TableHead className="text-xs">Tipe Event</TableHead>
                      <TableHead className="text-xs">Status Assign</TableHead>
                      <TableHead className="text-xs">Sequence</TableHead>
                      <TableHead className="text-xs">Perangkat / Boot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((evt) => (
                      <TableRow key={evt.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-mono tabular-nums">
                          {new Date(evt.receivedAt).toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">
                          {new Date(evt.deviceTime).toLocaleTimeString('id-ID')}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          <Badge
                            variant={evt.eventType === 'DETECTION' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {getEventLabel(evt.eventType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {evt.eventType === 'DETECTION' ? (
                            <StatusBadge tone={evt.assignmentStatus === 'ASSIGNED' ? 'success' : 'warning'}>
                              {getAssignmentLabel(evt.assignmentStatus)}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono tabular-nums">
                          #{evt.sequence}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {evt.device?.deviceCode || evt.deviceId} ({evt.bootId.slice(0, 8)}...)
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
