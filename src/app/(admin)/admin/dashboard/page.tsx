'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Truck,
  Layers,
  Activity,
  PlusCircle,
  Play,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { useWebSocket } from '@/components/layout/ws-provider';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { lastMessage } = useWebSocket();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/dashboard/admin');
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data dashboard');
      
      setData(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as any).type;
      if (
        type === 'session.started' || 
        type === 'session.finished' || 
        type === 'session.cancelled' || 
        type === 'receiving.queue_updated' ||
        type === 'session.counter_updated' ||
        type === 'device.heartbeat_received' ||
        type === 'device.status_updated' ||
        type === 'audit.created' ||
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        fetchDashboard();
      }
    }
  }, [lastMessage, fetchDashboard]);

  if (loading && !data) {
    return <div className="p-6 text-center text-muted-foreground"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  if (errorMsg) {
    return <div className="p-6 text-center text-red-600 font-medium">{errorMsg}</div>;
  }

  if (!data) return null;

  const deviceStatusClass = (status?: string) => {
    if (status === 'ONLINE') return 'text-emerald-700 dark:text-emerald-400';
    if (status === 'DEGRADED') return 'text-amber-700 dark:text-amber-400';
    return 'text-red-700 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard Administrator</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ringkasan menyeluruh penerimaan ayam, performa line, sensor, dan log audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="bg-purple-600 hover:bg-purple-500 gap-1.5 text-xs">
            <Link href="/admin/receiving">
              <PlusCircle className="h-4 w-4" />
              <span>Input Surat Jalan Baru</span>
            </Link>
          </Button>

          <Button variant="outline" asChild className="gap-1.5 text-xs border-purple-300">
            <Link href="/admin/counting">
              <Play className="h-4 w-4 text-purple-600" />
              <span>Buka Console Counting</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Manifest Hari Ini</p>
              <p className="text-2xl font-bold text-foreground mt-1">{(data.totalManifestToday || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Actual Selesai Hari Ini</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{(data.actualCompletedToday || 0).toLocaleString()}</p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">{data.completedReceivingCount || 0} Truck Selesai</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Selisih Akhir (Final)</p>
              <p className={`text-2xl font-bold mt-1 ${data.finalDifferenceCount < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {data.finalDifferenceCount > 0 ? '+' : ''}{data.finalDifferenceCount.toLocaleString()}
              </p>
              <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${data.finalDifferencePercent < 0 ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-emerald-700/80 dark:text-emerald-400/80'}`}>
                <TrendingDown className="h-3 w-3" /> {data.finalDifferencePercent}% Variance
              </p>
            </div>
            <div className={`p-3 rounded-xl ${data.finalDifferenceCount < 0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Status Line Aktif</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">{data.activeLinesCount} / {data.linesOverview?.length || 0} Line</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Antrean: {data.waitingQueueCount} Truck</p>
            </div>
            <div className="p-3 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Status Operational Line</span>
                <Badge variant="outline">{data.activeLinesCount} Active Lines</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.linesOverview?.map((item: any) => (
                <div key={item.line.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{item.line.name}</span>
                      {item.activeSession ? (
                        <StatusBadge tone="warning" className="animate-pulse text-[10px]">COUNTING</StatusBadge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">IDLE</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground text-right">
                      {item.device ? (
                        <>
                          <span className={`font-semibold ${deviceStatusClass(item.device.status)}`}>
                            {item.device.status}
                          </span>
                          {` ${item.device.deviceCode} • RSSI ${item.device.wifiRssi || '-'}dBm`}
                          <br />
                          <span className="text-[10px]">
                            Heartbeat:{' '}
                            {item.device.lastHeartbeatAt
                              ? new Date(item.device.lastHeartbeatAt).toLocaleTimeString('id-ID')
                              : 'Belum ada'}
                          </span>
                        </>
                      ) : (
                        'Tidak ada perangkat'
                      )}
                    </span>
                  </div>
                  
                  {item.activeSession ? (
                    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                      <div>
                        <span className="text-muted-foreground">Truck Aktif:</span>
                        <p className="font-bold text-purple-700 dark:text-purple-400">{item.activeSession.receiving?.licensePlateSnapshot}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Manifest:</span>
                        <p className="font-bold text-foreground">{(item.activeSession.receiving?.manifestCount || 0).toLocaleString()} ekor</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual Sensor:</span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{(item.activeSession.actualCount || 0).toLocaleString()} ekor</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-2">Tidak ada sesi penghitungan aktif.</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-purple-600" />
                <span>Audit Trail Terbaru</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Aktivitas penting sistem tercatat immutable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                {data.recentAuditLogs?.length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-4">Belum ada log audit.</p>
                ) : (
                  data.recentAuditLogs?.map((log: any) => (
                    <div key={log.id} className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-purple-700 dark:text-purple-400">{log.action}</span>
                        <span className="text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-foreground font-medium">{log.entityType} ({log.entityId.substring(0,8)}...)</p>
                      <p className="text-[10px] text-muted-foreground">Oleh: {log.actor?.email || 'System'}</p>
                    </div>
                  ))
                )}
              </div>

              <Button variant="ghost" size="sm" asChild className="w-full mt-4 text-xs gap-1 text-purple-600">
                <Link href="/admin/audit-trail">
                  <span>Lihat Semua Audit Log</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
