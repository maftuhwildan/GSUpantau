'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, AlertCircle, Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data audit logs');
      
      setLogs(result.logs || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, actorFilter, dateFrom, dateTo]);

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
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" description="Rekam jejak aktivitas sistem yang immutable dan tidak dapat diubah atau dihapus." actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="text-xs gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
      } />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interactive Filters */}
      <Card className="border-border p-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="audit-action">Aksi (Action)</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}><SelectTrigger id="audit-action" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                {['ALL','LOGIN','CREATE_RECEIVING','UPDATE_RECEIVING','PUBLISH_RECEIVING','CANCEL_RECEIVING','START_SESSION','FINISH_SESSION','CANCEL_SESSION','CREATE_USER','UPDATE_USER','CREATE_LINE','CREATE_DEVICE'].map((action) => <SelectItem key={action} value={action}>{action === 'ALL' ? 'Semua Action' : action}</SelectItem>)}
              </SelectContent></Select>
            </div>

            <div>
              <Label htmlFor="audit-entity">Tipe Entitas</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}><SelectTrigger id="audit-entity" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                {['ALL','receiving','receiving_session','user','line','device','truck','driver','supplier','app_settings'].map((entity) => <SelectItem key={entity} value={entity}>{entity === 'ALL' ? 'Semua Entitas' : entity}</SelectItem>)}
              </SelectContent></Select>
            </div>

            <div>
              <Label htmlFor="audit-actor">Aktor (Pengguna)</Label>
              <Select value={actorFilter} onValueChange={setActorFilter}><SelectTrigger id="audit-actor" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Semua Aktor</SelectItem>
                {usersList.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.roles?.join(', ') || 'USER'})
                  </SelectItem>
                ))}
              </SelectContent></Select>
            </div>

            <div>
              <Label htmlFor="audit-date-from">Dari Waktu</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="audit-date-to">Sampai Waktu</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={loading} className="h-8 text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">100 Log Terbaru</CardTitle>
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
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
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
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{log.actor?.name || 'Sistem'}</div>
                        <div className="text-[10px] text-muted-foreground">{log.actorRole || log.source}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-foreground">{log.entityType}</span> <br/>
                        <span className="text-[10px] font-mono text-muted-foreground truncate block max-w-[120px]">{log.entityId}</span>
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
                          <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
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
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              Detail Audit Log: {selectedLog?.action}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Informasi lengkap perubahan entitas <strong>{selectedLog?.entityType}</strong> (ID: {selectedLog?.entityId}) pada{' '}
              {selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString('id-ID') : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs">
              <div>
                <span className="text-muted-foreground font-semibold">Aktor:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.actor?.name || 'Sistem'}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Role / Sumber:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.actorRole || selectedLog?.source}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground font-semibold">Alasan Perubahan:</span>{' '}
                <span className="font-medium text-foreground">{selectedLog?.reason || 'Tidak ada alasan khusus'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Data */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Data Sebelum (Before)
                </label>
                <div className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60 border">
                  {selectedLog?.beforeData ? (
                    <pre>{JSON.stringify(selectedLog.beforeData, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-500 italic">Data kosong (Aksi Pembuatan Baru)</span>
                  )}
                </div>
              </div>

              {/* After Data */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Data Sesudah (After)
                </label>
                <div className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60 border">
                  {selectedLog?.afterData ? (
                    <pre>{JSON.stringify(selectedLog.afterData, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-500 italic">Data kosong (Aksi Penghapusan/Pembatalan)</span>
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
