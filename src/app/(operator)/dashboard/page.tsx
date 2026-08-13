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
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useWebSocket } from '@/components/layout/ws-provider';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StartCountingDialog } from '@/components/receiving/start-counting-dialog';
import type { OperatorDashboardData } from '@/types/operator-dashboard';

export default function OperatorDashboardPage() {
  const [data, setData] = useState<OperatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const { lastMessage } = useWebSocket();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/dashboard/operator');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data dashboard');

      setData(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as Record<string, unknown>).type;
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

  const deviceStatus = data.device?.status || 'UNREGISTERED';
  const activeSession = data.activeSession;
  const activeReceiving = activeSession?.receiving;
  const manifestCount = activeReceiving?.manifestCount || 0;
  const actualCount = activeSession?.actualCount || 0;
  const activeDifference = activeSession ? actualCount - manifestCount : 0;

  // Safe progress percentage calculation
  const progressPercent = manifestCount > 0 ? Math.min(100, Math.round((actualCount / manifestCount) * 100)) : null;

  const deviceTone: 'success' | 'warning' | 'danger' | 'neutral' =
    deviceStatus === 'ONLINE'
      ? 'success'
      : deviceStatus === 'DEGRADED'
      ? 'warning'
      : deviceStatus === 'OFFLINE'
      ? 'danger'
      : 'neutral';

  const firstWaitingItem = data.waitingQueue.length > 0 ? data.waitingQueue[0] : null;
  const totalDetectionsToday = data.assignedDetections + data.unassignedDetections;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Operator"
        description="Pantau status penghitungan truck penerimaan ayam secara realtime."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.line && (
              <Badge variant="outline" className="gap-1.5 py-1 text-xs">
                <Layers className="size-3.5 text-primary" />
                <span>{data.line.name} ({data.line.lineCode})</span>
              </Badge>
            )}
            <StatusBadge tone={data.line?.status === 'ACTIVE' ? 'success' : 'warning'}>
              Jalur {data.line?.status || 'IDLE'}
            </StatusBadge>
            <StatusBadge tone={activeSession ? 'warning' : 'neutral'}>
              {activeSession ? 'Sesi Aktif' : 'IDLE'}
            </StatusBadge>
          </div>
        }
      />

      {/* Sensor Health Status Alert if Stale / Degraded / Offline */}
      {data.device && deviceStatus !== 'ONLINE' && (
        <Alert variant={deviceStatus === 'OFFLINE' ? 'destructive' : 'default'}>
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <AlertTitle>Peringatan Perangkat Sensor</AlertTitle>
          <AlertDescription>
            Status sensor pada jalur ini adalah <strong>{deviceStatus}</strong>. ({data.device.deviceCode || 'N/A'}) - Pastikan koneksi alat fisik diperiksa sebelum penghitungan.
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Section: Active Session or Line Ready Idle */}
      {activeSession ? (
        <Card className="border-primary/20 bg-card">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      Truck Sedang Dihitung: {activeReceiving?.licensePlateSnapshot || '-'}
                    </CardTitle>
                    <StatusBadge tone="warning">COUNTING</StatusBadge>
                  </div>
                  <CardDescription className="text-xs">
                    No. Surat Jalan: <span className="font-medium text-foreground">{activeReceiving?.deliveryNoteNumber || '-'}</span> • Supplier: <span className="font-medium text-foreground">{activeReceiving?.supplierNameSnapshot || '-'}</span>
                  </CardDescription>
                </div>
              </div>
              <Button asChild size="sm" className="gap-2">
                <Link href="/active-session">
                  <Play className="size-4" />
                  <span>Buka Sesi Aktif</span>
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Manifest Surat Jalan"
                value={manifestCount.toLocaleString('id-ID')}
                detail="Ekor terdaftar"
                icon={Layers}
                tone="info"
              />
              <KpiCard
                label="Actual Sensor"
                value={actualCount.toLocaleString('id-ID')}
                detail={activeSession.lastDetection ? `Terakhir ${new Date(activeSession.lastDetection).toLocaleTimeString('id-ID')}` : 'Belum ada deteksi'}
                icon={Radio}
                tone="success"
              />
              <KpiCard
                label="Selisih Sementara"
                value={activeDifference > 0 ? `+${activeDifference.toLocaleString('id-ID')}` : activeDifference.toLocaleString('id-ID')}
                detail="Proses belum selesai"
                icon={AlertTriangle}
                tone={activeDifference === 0 ? 'success' : 'warning'}
              />
              <KpiCard
                label="Status Sensor Line"
                value={deviceStatus}
                detail={`${data.device?.deviceCode || '-'} • RSSI ${data.device?.wifiRssi ?? '-'} dBm`}
                icon={Wifi}
                tone={deviceTone}
              />
            </div>

            {/* Informational Progress Bar */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Kemajuan Terhadap Manifest Surat Jalan</span>
                <span className="font-semibold tabular-nums">
                  {progressPercent !== null ? `${progressPercent}% (${actualCount.toLocaleString('id-ID')} / ${manifestCount.toLocaleString('id-ID')} ekor)` : 'N/A'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                * Merekap progress penghitungan. Sesi harus diselesaikan secara manual melalui konfirmasi setelah truck selesai.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <CheckCircle2 className="size-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Jalur Siap Digunakan (IDLE)</CardTitle>
                  <CardDescription className="text-xs">
                    Tidak ada sesi penghitungan aktif di {data.line?.name || 'Line ini'}. Pilihlah truck pertama dari antrean untuk memulai.
                  </CardDescription>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/receiving-queue">
                  <ListOrdered className="size-4" />
                  <span>Buka Antrean</span>
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {firstWaitingItem ? (
              <div className="rounded-xl border bg-muted/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Antrean Pertama (Posisi #{firstWaitingItem.queuePosition})
                    </span>
                    <h3 className="font-heading text-xl font-semibold mt-1">
                      {firstWaitingItem.licensePlateSnapshot}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      No. Surat Jalan: <span className="font-medium text-foreground">{firstWaitingItem.deliveryNoteNumber}</span> • Supplier: <span className="font-medium text-foreground">{firstWaitingItem.supplierNameSnapshot}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Manifest</p>
                    <p className="font-heading text-xl font-semibold tabular-nums text-foreground">
                      {firstWaitingItem.manifestCount.toLocaleString('id-ID')} <span className="text-xs font-normal">ekor</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-end">
                  <Button
                    onClick={() => setStartDialogOpen(true)}
                    className="gap-2"
                  >
                    <Play className="size-4" />
                    <span>Mulai Penghitungan Truck Ini</span>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Truck}
                title="Tidak Ada Antrean Menunggu"
                description="Antrean Surat Jalan kosong. Hubungi Admin untuk memasukkan data Surat Jalan baru."
                action={
                  <Button asChild variant="outline">
                    <Link href="/receiving-queue">Lihat Daftar Antrean</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Operational Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waiting Queue Preview */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Antrean Menunggu</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="tabular-nums">
                  Total: {data.waitingQueueCount} Truck
                </Badge>
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs gap-1">
                  <Link href="/receiving-queue">
                    <span>Lihat Semua ({data.waitingQueueCount})</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {data.waitingQueue.length === 0 ? (
              <div className="p-6">
                <p className="text-xs text-muted-foreground text-center italic">Tidak ada antrean menunggu saat ini.</p>
              </div>
            ) : (
              data.waitingQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{item.licensePlateSnapshot}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        #{item.queuePosition}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No. SJ: {item.deliveryNoteNumber} • {item.supplierNameSnapshot}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-sm font-semibold tabular-nums">{item.manifestCount.toLocaleString('id-ID')} ekor</p>
                    <span className="text-xs text-muted-foreground">Menunggu</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Today's Detections Summary (Numbers & Alert Only - No Donut Chart) */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bird className="size-4 text-primary" />
              <span>Ringkasan Deteksi Hari Ini</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Total event deteksi sensor produksi pada jalur ini ({data.line?.name || 'Assigned Line'}).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {totalDetectionsToday === 0 ? (
              <EmptyState
                icon={Bird}
                title="Belum ada deteksi hari ini"
                description="Statistik deteksi assigned dan unassigned akan diperbarui otomatis begitu sensor mendeteksi ayam."
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <StatusBadge tone="success">Assigned</StatusBadge>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">
                      {data.assignedDetections.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">Assigned (Sesi Aktif)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <StatusBadge tone="warning">Unassigned</StatusBadge>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">
                      {data.unassignedDetections.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">Unassigned (Tanpa Sesi)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Alert for Unassigned Detections */}
            {data.unassignedDetections > 0 && (
              <Alert className="text-xs border-warning/50 bg-warning/10 text-warning-foreground">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <AlertTitle className="text-xs font-semibold">Deteksi Unassigned Terdeteksi ({data.unassignedDetections.toLocaleString('id-ID')} ekor)</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Terdapat deteksi sensor yang masuk saat tidak ada sesi aktif. Pastikan sesi dimulai sebelum penggantungan ayam dan diselesaikan tepat saat truck habis.
                  <div className="mt-2">
                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                      <Link href="/sensor-activity">Periksa Log Sensor Activity</Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Alert className="text-xs">
              <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
              <AlertTitle className="text-xs font-semibold">Aturan SOP Batas Truck</AlertTitle>
              <AlertDescription className="text-xs">
                Pastikan truck yang sedang dihitung benar-benar habis dan penggantungan ayam pada conveyor berhenti sebelum menekan tombol Selesaikan Sesi.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Start Counting Dialog for 1st Waiting Item */}
      {firstWaitingItem && (
        <StartCountingDialog
          open={startDialogOpen}
          onOpenChange={setStartDialogOpen}
          receivingId={firstWaitingItem.id}
          deliveryNoteNumber={firstWaitingItem.deliveryNoteNumber}
          isAdmin={false}
        />
      )}
    </div>
  );
}
