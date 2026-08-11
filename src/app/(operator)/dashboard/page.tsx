'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Layers,
  ArrowRight,
  Bird,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { getDetectionChartData } from '@/lib/chart-data';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Pie, PieChart } from 'recharts';

const detectionChartConfig = {
  assigned: { label: 'Assigned', color: 'var(--metric-assigned)' },
  unassigned: { label: 'Unassigned', color: 'var(--metric-unassigned)' },
} satisfies ChartConfig;

type DashboardData = {
  line: any;
  device: any;
  activeSession: any;
  waitingQueue: any[];
  assignedDetections: number;
  unassignedDetections: number;
};

export default function OperatorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { lastMessage } = useWebSocket();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/dashboard/operator');
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
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        fetchDashboard();
      }
    }
  }, [lastMessage, fetchDashboard]);

  if (loading && !data) {
    return <LoadingState label="Memuat dashboard Operator" rows={4} />;
  }

  if (errorMsg) {
    return <ErrorState description={errorMsg} onRetry={fetchDashboard} />;
  }

  if (!data) return null;

  const deviceStatus = data.device?.status || 'UNKNOWN';
  const deviceStatusTone =
    deviceStatus === 'ONLINE'
      ? 'text-device-online'
      : deviceStatus === 'DEGRADED'
      ? 'text-device-degraded'
      : deviceStatus === 'OFFLINE'
      ? 'text-device-offline'
      : 'text-device-unknown';
  const deviceStatusDot =
    deviceStatus === 'ONLINE'
      ? 'bg-device-online animate-ping'
      : deviceStatus === 'DEGRADED'
      ? 'bg-device-degraded'
      : deviceStatus === 'OFFLINE'
      ? 'bg-device-offline'
      : 'bg-device-unknown';

  return (
    <div className="space-y-6">
      {/* Top Banner / Line Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background dark:bg-card p-6 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Dashboard Operator • {data.line?.name || 'Belum ada Line'}
            </h1>
            <StatusBadge tone={data.activeSession ? 'success' : 'neutral'}>
              {data.activeSession ? 'Sesi Aktif' : 'IDLE'}
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pantau status penghitungan truck penerimaan ayam secara realtime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/receiving-queue">
              <Layers className="h-4 w-4 text-primary" />
              <span>Lihat Antrean ({data.waitingQueue.length})</span>
            </Link>
          </Button>

          {data.activeSession && (
            <Button size="sm" asChild className="bg-primary hover:bg-primary gap-1.5">
              <Link href="/active-session">
                <Play className="h-4 w-4" />
                <span>Buka Console Sesi Aktif</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Primary Active Session Highlight */}
      {data.activeSession ? (
        <Card className="border-primary/25  bg-linear-to-br from-background via-primary/10 to-primary/10 dark:from-card  shadow-md">
          <CardHeader className="pb-3 border-b border-primary/25 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Truck Sedang Dihitung: {data.activeSession.receiving?.licensePlateSnapshot}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    No. Surat Jalan: {data.activeSession.receiving?.deliveryNoteNumber} • Supplier: {data.activeSession.receiving?.supplierNameSnapshot}
                  </CardDescription>
                </div>
              </div>
              <StatusBadge tone="warning" className="animate-pulse">
                COUNTING
              </StatusBadge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-background dark:bg-card border border-border shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Manifest (Surat Jalan)</p>
                <p className="text-3xl font-extrabold text-foreground mt-1">
                  {data.activeSession.receiving?.manifestCount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Ekor Terdaftar</p>
              </div>

              <div className="p-4 rounded-xl bg-primary text-primary-foreground shadow-md relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-medium text-primary">Hitung Realtime (Sensor)</p>
                  <Radio className="h-4 w-4 animate-pulse text-primary" />
                </div>
                <p className="text-3xl font-extrabold mt-1 tracking-tight">
                  {(data.activeSession.actualCount || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Deteksi terakhir:{' '}
                  {data.activeSession.lastDetection
                    ? new Date(data.activeSession.lastDetection).toLocaleTimeString()
                    : 'Belum ada'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-background dark:bg-card border border-border shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Selisih Sementara</p>
                <p className="text-3xl font-extrabold text-warning-foreground  mt-1">
                  {((data.activeSession.actualCount || 0) - (data.activeSession.receiving?.manifestCount || 0)).toLocaleString()}
                </p>
                <p className="text-[10px] text-warning-foreground  mt-1 font-medium">
                  Proses Belum Selesai
                </p>
              </div>

              <div className="p-4 rounded-xl bg-background dark:bg-card border border-border shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status Sensor Line</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`h-3 w-3 rounded-full ${deviceStatusDot}`} />
                    <span className={`font-bold text-sm ${deviceStatusTone}`}>
                      {deviceStatus} ({data.device?.deviceCode || '-'})
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  Heartbeat terakhir:{' '}
                  {data.device?.lastHeartbeatAt
                    ? new Date(data.device.lastHeartbeatAt).toLocaleTimeString('id-ID')
                    : 'Belum ada'}
                  <br />
                  RSSI: {data.device?.wifiRssi || '-'} dBm
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="default" asChild className="bg-primary hover:bg-primary gap-2">
                <Link href="/active-session">
                  <span>Kelola & Selesaikan Sesi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border p-12 text-center bg-muted  border-dashed">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">Tidak Ada Sesi Aktif</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-6">Line ini sedang idle. Buka antrean untuk memulai penghitungan truck berikutnya.</p>
          <Button asChild className="bg-primary hover:bg-primary">
            <Link href="/receiving-queue">Buka Antrean Menunggu</Link>
          </Button>
        </Card>
      )}

      {/* Bottom Operational Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Antrean Menunggu (Waiting Queue)</span>
              <Badge variant="secondary">{data.waitingQueue.length} Truck</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.waitingQueue.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Tidak ada antrean.</p>
            ) : (
              data.waitingQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted  border border-border  text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{item.licensePlateSnapshot}</span>
                      <span className="text-muted-foreground">({item.deliveryNoteNumber})</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{item.supplierNameSnapshot}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary ">{item.manifestCount.toLocaleString()} ekor</p>
                    <span className="text-[10px] text-muted-foreground">Siap Dihitung</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bird className="h-4 w-4 text-primary" />
              <span>Ringkasan Deteksi Hari Ini</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {data.assignedDetections + data.unassignedDetections === 0 ? (
              <EmptyState icon={Bird} title="Belum ada deteksi hari ini" description="Distribusi assigned dan unassigned akan muncul setelah sensor mengirim event." />
            ) : (
              <>
                <ChartContainer config={detectionChartConfig} className="mx-auto h-[240px] w-full max-w-sm">
                  <PieChart accessibilityLayer>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={getDetectionChartData(data.assignedDetections, data.unassignedDetections)}
                      dataKey="value"
                      nameKey="key"
                      innerRadius={58}
                      outerRadius={86}
                      strokeWidth={4}
                    />
                    <ChartLegend content={<ChartLegendContent nameKey="key" />} />
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-metric-assigned/10 p-3 text-metric-assigned">
                    <p className="text-xl font-bold">{data.assignedDetections.toLocaleString()}</p>
                    <p className="text-[10px]">Assigned</p>
                  </div>
                  <div className="rounded-lg bg-metric-unassigned/10 p-3 text-warning-foreground">
                    <p className="text-xl font-bold">{data.unassignedDetections.toLocaleString()}</p>
                    <p className="text-[10px]">Unassigned</p>
                  </div>
                </div>
              </>
            )}

            <div className="p-3 rounded-lg bg-primary/10  border border-primary/25  text-primary  text-[11px] leading-relaxed">
              <strong>Aturan SOP Batas Truck:</strong> Pastikan truck yang sedang dihitung benar-benar selesai dan proses penggantungan berhenti sebelum menyelesaikan sesi agar deteksi berikutnya tidak menjadi <em>unassigned</em>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
