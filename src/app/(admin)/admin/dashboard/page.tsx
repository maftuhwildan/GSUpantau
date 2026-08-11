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
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { getActiveLineChartData } from '@/lib/chart-data';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const activeLineChartConfig = {
  manifest: { label: 'Manifest', color: 'var(--metric-manifest)' },
  actual: { label: 'Actual', color: 'var(--metric-actual)' },
} satisfies ChartConfig;

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
    return <LoadingState label="Memuat dashboard Admin" rows={4} />;
  }

  if (errorMsg) {
    return <ErrorState description={errorMsg} onRetry={fetchDashboard} />;
  }

  if (!data) return null;

  const deviceStatusClass = (status?: string) => {
    if (status === 'ONLINE') return 'text-device-online';
    if (status === 'DEGRADED') return 'text-device-degraded';
    if (status === 'OFFLINE') return 'text-device-offline';
    return 'text-device-unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background dark:bg-card p-6 rounded-xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard Administrator</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ringkasan menyeluruh penerimaan ayam, performa line, sensor, dan log audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="bg-primary hover:bg-primary gap-1.5 text-xs">
            <Link href="/admin/receiving">
              <PlusCircle className="h-4 w-4" />
              <span>Input Surat Jalan Baru</span>
            </Link>
          </Button>

          <Button variant="outline" asChild className="gap-1.5 text-xs border-primary/25">
            <Link href="/admin/counting">
              <Play className="h-4 w-4 text-primary" />
              <span>Buka Console Counting</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Manifest Hari Ini" value={(data.totalManifestToday || 0).toLocaleString('id-ID')} icon={FileText} />
        <KpiCard label="Actual Selesai Hari Ini" value={(data.actualCompletedToday || 0).toLocaleString('id-ID')} detail={`${data.completedReceivingCount || 0} Truck Selesai`} icon={CheckCircle2} tone="success" />
        <KpiCard label="Selisih Akhir (Final)" value={`${data.finalDifferenceCount > 0 ? '+' : ''}${data.finalDifferenceCount.toLocaleString('id-ID')}`} detail={`${data.finalDifferencePercent}% Variance`} icon={AlertTriangle} tone={data.finalDifferenceCount < 0 ? 'warning' : 'success'} />
        <KpiCard label="Status Line Aktif" value={`${data.activeLinesCount} / ${data.linesOverview?.length || 0} Line`} detail={`Antrean: ${data.waitingQueueCount} Truck`} icon={Activity} tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perbandingan Sesi Aktif per Line</CardTitle>
          <CardDescription>Manifest dan actual sensor dari sesi yang sedang berjalan.</CardDescription>
        </CardHeader>
        <CardContent>
          {getActiveLineChartData(data.linesOverview).length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada sesi aktif" description="Chart akan muncul ketika counting dimulai pada salah satu line." />
          ) : (
            <ChartContainer config={activeLineChartConfig} className="h-[260px] w-full">
              <BarChart accessibilityLayer data={getActiveLineChartData(data.linesOverview)} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="line" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="manifest" fill="var(--color-manifest)" radius={4} />
                <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

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
                <div key={item.line.id} className="p-4 rounded-xl bg-muted  border border-border  space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{item.line.name}</span>
                      {item.activeSession ? (
                        <StatusBadge tone="warning" className="animate-pulse text-[10px]">COUNTING</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" className="text-[10px]">IDLE</StatusBadge>
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
                        <p className="font-bold text-primary ">{item.activeSession.receiving?.licensePlateSnapshot}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Manifest:</span>
                        <p className="font-bold text-foreground">{(item.activeSession.receiving?.manifestCount || 0).toLocaleString()} ekor</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual Sensor:</span>
                        <p className="font-bold text-success ">{(item.activeSession.actualCount || 0).toLocaleString()} ekor</p>
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
                <History className="h-4 w-4 text-primary" />
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
                    <div key={log.id} className="p-2.5 rounded bg-muted  border border-border  space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-primary ">{log.action}</span>
                        <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-foreground font-medium">{log.entityType} ({log.entityId.substring(0,8)}...)</p>
                      <p className="text-[10px] text-muted-foreground">Oleh: {log.actor?.email || 'System'}</p>
                    </div>
                  ))
                )}
              </div>

              <Button variant="ghost" size="sm" asChild className="w-full mt-4 text-xs gap-1 text-primary">
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
