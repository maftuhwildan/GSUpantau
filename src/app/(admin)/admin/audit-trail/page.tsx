'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { History, RefreshCw, AlertCircle, Eye, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateRangePicker, type DateOnlyRange } from '@/components/ui/date-picker';
import { PageHeader } from '@/components/layout/PageHeader';
import { appendDateRangeParams } from '@/lib/ui-date';
import { formatAuditActionLabel, formatAuditEntityLabel } from '@/lib/audit-filter';
import { computeAuditDiff, redactSensitiveData } from '@/lib/audit-diff';
import { useUrlFilters } from '@/lib/use-url-filters';

interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: Record<string, any> | null;
  afterData: Record<string, any> | null;
  reason: string | null;
  source: string;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { lastMessage } = useWebSocket();

  // Persistent URL Filters
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters({
    action: 'ALL',
    entity_type: 'ALL',
    actor_id: 'ALL',
    date_from: undefined,
    date_to: undefined,
  });

  const actionFilter = filters.action || 'ALL';
  const entityFilter = filters.entity_type || 'ALL';
  const actorFilter = filters.actor_id || 'ALL';
  const dateRange: DateOnlyRange = useMemo(
    () => ({
      from: filters.date_from || undefined,
      to: filters.date_to || undefined,
    }),
    [filters.date_from, filters.date_to]
  );

  const setDateRange = (range: DateOnlyRange) => {
    setFilters({
      date_from: range.from || undefined,
      date_to: range.to || undefined,
    });
  };

  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [rawJsonOpen, setRawJsonOpen] = useState(false);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMsg(msg);
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
    if (lastMessage && typeof lastMessage === 'object') {
      const type = (lastMessage as { type?: unknown }).type;
      if (
        typeof type === 'string' &&
        (type === 'audit.created' || type === 'realtime.reconnected' || type === 'realtime.poll')
      ) {
        fetchLogs();
      }
    }
  }, [lastMessage, fetchLogs]);

  const hasActiveFilters = Boolean(
    actionFilter !== 'ALL' ||
      entityFilter !== 'ALL' ||
      actorFilter !== 'ALL' ||
      dateRange.from ||
      dateRange.to
  );

  const selectedDiff = useMemo(() => {
    if (!selectedLog) return [];
    return computeAuditDiff(selectedLog.beforeData, selectedLog.afterData);
  }, [selectedLog]);

  const redactedBeforeData = useMemo(() => {
    if (!selectedLog?.beforeData) return null;
    return redactSensitiveData(selectedLog.beforeData);
  }, [selectedLog]);

  const redactedAfterData = useMemo(() => {
    if (!selectedLog?.afterData) return null;
    return redactSensitiveData(selectedLog.afterData);
  }, [selectedLog]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Rekam jejak aktivitas sistem yang immutable dan tidak dapat diubah atau dihapus."
        eyebrow="Admin"
        actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1 min-h-[44px] sm:min-h-0">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </Button>
        }
      />

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
              <Select value={actionFilter} onValueChange={(val) => setFilter('action', val)}>
                <SelectTrigger id="audit-action" className="h-11! w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Aksi</SelectItem>
                  {actionOptions.map((action) => (
                    <SelectItem key={action} value={action}>{formatAuditActionLabel(action)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-entity" className="text-xs">Tipe entitas</Label>
              <Select value={entityFilter} onValueChange={(val) => setFilter('entity_type', val)}>
                <SelectTrigger id="audit-entity" className="h-11! w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Entitas</SelectItem>
                  {entityOptions.map((entity) => (
                    <SelectItem key={entity} value={entity}>{formatAuditEntityLabel(entity)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-actor" className="text-xs">Aktor</Label>
              <Select value={actorFilter} onValueChange={(val) => setFilter('actor_id', val)}>
                <SelectTrigger id="audit-actor" className="h-11! w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Aktor</SelectItem>
                  <SelectItem value="SYSTEM">Sistem</SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.roles?.join(', ') || 'USER'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            onClick={resetFilters}
            disabled={loading || !hasActiveFilters}
            className="h-11 w-full shrink-0 gap-1.5 xl:w-auto min-h-[44px] sm:min-h-0"
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
        <CardContent className="p-0 sm:p-6">
          {logs.length === 0 && !loading ? (
            <p className="text-center py-8 text-muted-foreground text-xs italic">
              Belum ada catatan audit yang cocok dengan filter.
            </p>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="divide-y divide-border md:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge tone="primary">
                        {formatAuditActionLabel(log.action)}
                      </StatusBadge>
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        Entitas: {formatAuditEntityLabel(log.entityType)}
                      </p>
                      <p className="text-muted-foreground text-xs font-mono truncate">
                        ID: {log.entityId}
                      </p>
                      <p className="text-muted-foreground">
                        Aktor: <span className="font-medium text-foreground">{log.actor?.name || 'Sistem'}</span> ({log.actorRole || log.source})
                      </p>
                      {log.reason && (
                        <p className="text-muted-foreground italic">
                          Alasan: &quot;{log.reason}&quot;
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRawJsonOpen(false);
                          setSelectedLog(log);
                        }}
                        className="gap-1 text-xs min-h-[44px] sm:min-h-0"
                      >
                        <Eye className="size-3.5" />
                        <span>Lihat Detail Diff</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
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
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-foreground">{log.actor?.name || 'Sistem'}</div>
                          <div className="text-xs text-muted-foreground">{log.actorRole || log.source}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <StatusBadge tone="primary">
                            {formatAuditActionLabel(log.action)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium text-foreground">{formatAuditEntityLabel(log.entityType)}</span> <br />
                          <span className="text-xs text-muted-foreground truncate block max-w-[120px] font-mono">{log.entityId}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {log.reason || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRawJsonOpen(false);
                              setSelectedLog(log);
                            }}
                            className="h-9 w-9 p-0 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0"
                            title="Lihat Detail Before / After"
                            aria-label="Lihat Detail Before / After"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
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

      {/* Modal Detail Audit Log dengan Human-Readable Diff & Collapsible JSON */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Detail Audit: {selectedLog ? formatAuditActionLabel(selectedLog.action) : ''}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Informasi lengkap perubahan entitas <strong>{selectedLog ? formatAuditEntityLabel(selectedLog.entityType) : ''}</strong> (ID: {selectedLog?.entityId}) pada{' '}
              {selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString('id-ID') : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Context Summary */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/60 rounded-lg border text-xs">
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
                <span className="font-medium text-foreground">{selectedLog?.reason || '—'}</span>
              </div>
            </div>

            {/* Human Readable Diff Table */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground">Ringkasan Perubahan Field</h4>
              {selectedDiff.length === 0 ? (
                <div className="p-3 rounded-md border bg-muted/30 text-xs text-muted-foreground italic">
                  {selectedLog?.beforeData && !selectedLog?.afterData
                    ? 'Aksi Penghapusan / Pembatalan Data'
                    : !selectedLog?.beforeData && selectedLog?.afterData
                    ? 'Aksi Pembuatan Data Baru'
                    : 'Tidak ada perubahan field spesifik yang terdeteksi.'}
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="text-xs">Field</TableHead>
                        <TableHead className="text-xs">Sebelum</TableHead>
                        <TableHead className="text-xs">Sesudah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDiff.map((item) => (
                        <TableRow key={item.field}>
                          <TableCell className="text-xs font-medium text-foreground font-mono">
                            {item.field}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.beforeValue}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-primary">
                            {item.afterValue}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Collapsible Raw JSON Data */}
            <Collapsible open={rawJsonOpen} onOpenChange={setRawJsonOpen} className="border rounded-md p-3 space-y-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full flex items-center justify-between p-0 h-auto font-medium text-xs text-muted-foreground hover:text-foreground">
                  <span>Lihat Data Mentah (Raw JSON)</span>
                  <ChevronDown className={`size-4 transition-transform ${rawJsonOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before Data */}
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground text-xs">
                      Data Sebelum (Before)
                    </p>
                    <div className="p-3 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto max-h-56 border">
                      {redactedBeforeData ? (
                        <pre>{JSON.stringify(redactedBeforeData, null, 2)}</pre>
                      ) : (
                        <span className="text-muted-foreground italic">— (Aksi Pembuatan Baru)</span>
                      )}
                    </div>
                  </div>

                  {/* After Data */}
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground text-xs">
                      Data Sesudah (After)
                    </p>
                    <div className="p-3 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto max-h-56 border">
                      {redactedAfterData ? (
                        <pre>{JSON.stringify(redactedAfterData, null, 2)}</pre>
                      ) : (
                        <span className="text-muted-foreground italic">— (Aksi Pembatalan)</span>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)} className="text-xs min-h-[44px] sm:min-h-0">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
