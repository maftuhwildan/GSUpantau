'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, AlertCircle, Eye, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateRangePicker, type DateOnlyRange } from '@/components/ui/date-picker';
import { PageHeader } from '@/components/layout/PageHeader';
import { appendDateRangeParams } from '@/lib/ui-date';
import { formatAuditActionLabel, formatAuditEntityLabel } from '@/lib/audit-filter';

export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { lastMessage } = useWebSocket();

  // Filters
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<DateOnlyRange>({});
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  // Selected Log for Detail Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsersList(json.users || []);
      }
    } catch {
      // Ignore user list fetch error
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const params = new URLSearchParams();
      params.append('limit', '100');
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      if (entityFilter && entityFilter !== 'ALL') params.append('entity_type', entityFilter);
      if (actorFilter && actorFilter !== 'ALL') params.append('actor_id', actorFilter);
      appendDateRangeParams(params, dateRange);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data audit logs');
      
      setLogs(result.logs || []);
      setActionOptions(result.filters?.actions || []);
      setEntityOptions(result.filters?.entityTypes || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, actorFilter, dateRange]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as any).type;
      if (
        type === 'audit.created' ||
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        fetchLogs();
      }
    }
  }, [lastMessage, fetchLogs]);

  const handleResetFilters = () => {
    setActionFilter('ALL');
    setEntityFilter('ALL');
    setActorFilter('ALL');
    setDateRange({});
  };

  const hasActiveFilters = Boolean(
    actionFilter !== 'ALL' ||
    entityFilter !== 'ALL' ||
    actorFilter !== 'ALL' ||
    dateRange.from ||
    dateRange.to
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" description="Rekam jejak aktivitas sistem yang immutable dan tidak dapat diubah atau dihapus." actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
      } />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Interactive Filters */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="flex min-w-48 items-center gap-3 xl:self-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-medium text-foreground">Filter audit</p>
              <p className="text-xs text-muted-foreground">Telusuri aktivitas sistem</p>
            </div>
          </div>

          <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="audit-action" className="text-xs">Aksi</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}><SelectTrigger id="audit-action" className="h-11! w-full"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Semua Aksi</SelectItem>
                {actionOptions.map((action) => (
                  <SelectItem key={action} value={action}>{formatAuditActionLabel(action)}</SelectItem>
                ))}
              </SelectContent></Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-entity" className="text-xs">Tipe entitas</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}><SelectTrigger id="audit-entity" className="h-11! w-full"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Semua Entitas</SelectItem>
                {entityOptions.map((entity) => (
                  <SelectItem key={entity} value={entity}>{formatAuditEntityLabel(entity)}</SelectItem>
                ))}
              </SelectContent></Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-actor" className="text-xs">Aktor</Label>
              <Select value={actorFilter} onValueChange={setActorFilter}><SelectTrigger id="audit-actor" className="h-11! w-full"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Semua Aktor</SelectItem>
                <SelectItem value="SYSTEM">Sistem</SelectItem>
                {usersList.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.roles?.join(', ') || 'USER'})
                  </SelectItem>
                ))}
              </SelectContent></Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-date-range" className="text-xs">Rentang waktu</Label>
              <DateRangePicker
                id="audit-date-range"
                value={dateRange}
                onValueChange={setDateRange}
                disabled={loading}
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleResetFilters}
            disabled={loading || !hasActiveFilters}
            className="h-11 w-full shrink-0 gap-1.5 xl:w-auto"
          >
            <RotateCcw className="size-3.5" /> Reset filter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle>100 Log Terbaru</CardTitle>
            <CardDescription className="text-xs">
              Menampilkan catatan aktivitas user dan sistem secara berurutan.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Total {logs.length} Log
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted ">
                <TableRow>
                  <TableHead className="text-xs w-[150px]">Waktu</TableHead>
                  <TableHead className="text-xs">Aktor</TableHead>
                  <TableHead className="text-xs">Aksi</TableHead>
                  <TableHead className="text-xs">Target Entitas</TableHead>
                  <TableHead className="text-xs">Alasan / Catatan</TableHead>
                  <TableHead className="text-xs text-center w-[80px]">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      Belum ada catatan audit yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{log.actor?.name || 'Sistem'}</div>
                        <div className="text-xs text-muted-foreground">{log.actorRole || log.source}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <StatusBadge tone="primary">
                          {log.action}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-foreground">{log.entityType}</span> <br/>
                        <span className="text-xs text-muted-foreground truncate block max-w-[120px]">{log.entityId}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {log.reason || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 w-7 p-0"
                          title="Lihat Detail Before / After"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground " />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Viewer Data Before & After */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Detail Audit Log: {selectedLog?.action}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Informasi lengkap perubahan entitas <strong>{selectedLog?.entityType}</strong> (ID: {selectedLog?.entityId}) pada{' '}
              {selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString('id-ID') : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted  rounded-lg border text-xs">
              <div>
                <span className="text-muted-foreground font-medium">Aktor:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.actor?.name || 'Sistem'}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Role / Sumber:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.actorRole || selectedLog?.source}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground font-medium">Alasan Perubahan:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.reason || 'Tidak ada alasan khusus'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Data */}
              <div className="space-y-1.5">
                <p className="font-medium text-muted-foreground">
                  Data Sebelum (Before)
                </p>
                <div className="p-3 bg-foreground text-muted-foreground rounded-lg text-xs font-mono overflow-x-auto max-h-60 border">
                  {selectedLog?.beforeData ? (
                    <pre>{JSON.stringify(selectedLog.beforeData, null, 2)}</pre>
                  ) : (
                    <span className="text-muted-foreground italic">Data kosong (Aksi Pembuatan Baru)</span>
                  )}
                </div>
              </div>

              {/* After Data */}
              <div className="space-y-1.5">
                <p className="font-medium text-muted-foreground">
                  Data Sesudah (After)
                </p>
                <div className="p-3 bg-foreground text-muted-foreground rounded-lg text-xs font-mono overflow-x-auto max-h-60 border">
                  {selectedLog?.afterData ? (
                    <pre>{JSON.stringify(selectedLog.afterData, null, 2)}</pre>
                  ) : (
                    <span className="text-muted-foreground italic">Data kosong (Aksi Penghapusan/Pembatalan)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)} className="text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
