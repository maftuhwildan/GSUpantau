'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Play,
  AlertTriangle,
  Radio,
  Layers,
  ArrowRight,
  Bird,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { getDetectionChartData } from '@/lib/chart-data';
import { useWebSocket } from '@/components/layout/ws-provider';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Pie, PieChart } from 'recharts';

const detectionChartConfig = {
  assigned: { label: 'Assigned', color: 'var(--chart-1)' },
  unassigned: { label: 'Unassigned', color: 'var(--chart-3)' },
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
  const activeDifference = data.activeSession
    ? (data.activeSession.actualCount || 0) - (data.activeSession.receiving?.manifestCount || 0)
    : 0;
  const deviceKpiTone: 'success' | 'warning' | 'danger' | 'neutral' =
    deviceStatus === 'ONLINE'
      ? 'success'
      : deviceStatus === 'DEGRADED'
      ? 'warning'
      : deviceStatus === 'OFFLINE'
      ? 'danger'
      : 'neutral';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dashboard Operator • ${data.line?.name || 'Belum ada Line'}`}
        description="Pantau status penghitungan truck penerimaan ayam secara realtime."
        actions={<>
          <StatusBadge tone={data.activeSession ? 'success' : 'neutral'}>{data.activeSession ? 'Sesi aktif' : 'IDLE'}</StatusBadge>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/receiving-queue">
              <Layers className="h-4 w-4 text-primary" />
              <span>Lihat Antrean ({data.waitingQueue.length})</span>
            </Link>
          </Button>

          {data.activeSession && (
            <Button size="sm" asChild>
              <Link href="/active-session">
                <Play className="h-4 w-4" />
                <span>Buka Console Sesi Aktif</span>
              </Link>
            </Button>
          )}
        </>}
      />

      {/* Primary Active Session Highlight */}
      {data.activeSession ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="size-5" />
                </div>
                <div>
                  <CardTitle>
                    Truck Sedang Dihitung: {data.activeSession.receiving?.licensePlateSnapshot}
                  </CardTitle>
                  <CardDescription>
                    No. Surat Jalan: {data.activeSession.receiving?.deliveryNoteNumber} • Supplier: {data.activeSession.receiving?.supplierNameSnapshot}
                  </CardDescription>
                </div>
              </div>
              <StatusBadge tone="warning">COUNTING</StatusBadge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Manifest Surat Jalan"
                value={(data.activeSession.receiving?.manifestCount || 0).toLocaleString('id-ID')}
                detail="Ekor terdaftar"
                icon={Layers}
                tone="info"
              />
              <KpiCard
                label="Actual Sensor"
                value={(data.activeSession.actualCount || 0).toLocaleString('id-ID')}
                detail={data.activeSession.lastDetection ? `Terakhir ${new Date(data.activeSession.lastDetection).toLocaleTimeString('id-ID')}` : 'Belum ada deteksi'}
                icon={Radio}
                tone="success"
              />
              <KpiCard
                label="Selisih Sementara"
                value={activeDifference > 0 ? `+${activeDifference.toLocaleString('id-ID')}` : activeDifference.toLocaleString('id-ID')}
                detail="Proses belum selesai"
                icon={AlertTriangle}
                tone="warning"
              />
              <KpiCard
                label="Status Sensor Line"
                value={deviceStatus}
                detail={`${data.device?.deviceCode || '-'} • RSSI ${data.device?.wifiRssi || '-'} dBm`}
                icon={Wifi}
                tone={deviceKpiTone}
              />
            </div>

            <div className="flex justify-end">
              <Button asChild>
                <Link href="/active-session">
                  <span>Kelola & Selesaikan Sesi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Truck}
          title="Tidak ada sesi aktif"
          description="Line ini sedang idle. Buka antrean untuk memulai penghitungan truck berikutnya."
          action={<Button asChild><Link href="/receiving-queue">Buka antrean menunggu</Link></Button>}
        />
      )}

      {/* Bottom Operational Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Antrean Menunggu (Waiting Queue)</span>
              <Badge variant="secondary">{data.waitingQueue.length} Truck</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {data.waitingQueue.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Tidak ada antrean.</p>
            ) : (
              data.waitingQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 text-xs first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.licensePlateSnapshot}</span>
                      <span className="text-muted-foreground">({item.deliveryNoteNumber})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.supplierNameSnapshot}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-normal tabular-nums">{item.manifestCount.toLocaleString('id-ID')} ekor</p>
                    <span className="text-xs text-muted-foreground">Siap Dihitung</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />
                    <div>
                      <p className="font-heading text-xl font-semibold tabular-nums">{data.assignedDetections.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-muted-foreground">Assigned</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-3)' }} />
                    <div>
                      <p className="font-heading text-xl font-semibold tabular-nums">{data.unassignedDetections.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-muted-foreground">Unassigned</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Alert>
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle>Aturan SOP batas truck</AlertTitle>
              <AlertDescription>Pastikan truck yang sedang dihitung benar-benar selesai dan proses penggantungan berhenti sebelum menyelesaikan sesi agar deteksi berikutnya tidak menjadi <em>unassigned</em>.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
