'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, AlertCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/components/layout/ws-provider';

export default function AdminSensorActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { lastMessage } = useWebSocket();

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/sensor-events?limit=100');
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data sensor events');
      
      setEvents(result.events || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as any).type;
      if (
        type === 'sensor.event_received' ||
        type === 'device.status_updated' ||
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        fetchEvents();
      }
    }
  }, [lastMessage, fetchEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sensor Activity (Admin)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pantau arus data mentah dari perangkat ESP32 di semua line.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} className="text-xs gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Log Sensor Terakhir (100 Event)</CardTitle>
          <CardDescription className="text-xs">
            Menampilkan event DETECTION, HEARTBEAT, dan DEVICE_RESTART.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="text-xs">Waktu</TableHead>
                  <TableHead className="text-xs">Device / Line</TableHead>
                  <TableHead className="text-xs">Tipe Event</TableHead>
                  <TableHead className="text-xs">Status Assign</TableHead>
                  <TableHead className="text-xs">Sequence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Belum ada data sensor.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((evt: any) => (
                    <TableRow key={evt.id}>
                      <TableCell className="text-xs">{new Date(evt.deviceTime).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{evt.device?.deviceCode || '-'}</div>
                        <div className="text-[10px] text-muted-foreground">{evt.line?.name || '-'}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={evt.eventType === 'DETECTION' ? 'default' : 'outline'} className={evt.eventType === 'DETECTION' ? 'bg-purple-600' : ''}>
                          {evt.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {evt.eventType === 'DETECTION' && (
                          <Badge variant={evt.assignmentStatus === 'ASSIGNED' ? 'success' : 'destructive'}>
                            {evt.assignmentStatus}
                          </Badge>
                        )}
                        {evt.eventType !== 'DETECTION' && <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">#{evt.sequence}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
