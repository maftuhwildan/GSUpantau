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
  CheckCircle2,
  ListOrdered,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StartCountingDialog } from '@/components/receiving/start-counting-dialog';
import { getCountingProgressPresentation } from '@/lib/counting-progress';
import type { OperatorDashboardData } from '@/types/operator-dashboard';

export default function OperatorDashboardPage() {
  const [data, setData] = useState<OperatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/dashboard/operator');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data dashboard');

      setData(result);
      setLastFetchedAt(new Date().toLocaleTimeString('id-ID'));
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
  const progress = getCountingProgressPresentation(manifestCount, actualCount);

  const firstWaitingItem = data.waitingQueue.length > 0 ? data.waitingQueue[0] : null;
  const totalDetectionsToday = data.assignedDetections + data.unassignedDetections;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Operator"
        description="Pantau status penghitungan truk penerimaan ayam secara realtime."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lastFetchedAt && (
              <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
                <Clock className="size-3 shrink-0" />
                Diperbarui {lastFetchedAt}
              </span>
            )}
            {data.line && (
              <Badge variant="outline" className="gap-1.5 py-1 text-xs">
                <Layers className="size-3.5 text-primary" />
                <span>{data.line.name} ({data.line.lineCode})</span>
              </Badge>
            )}
          </div>
        }
      />

      {/* Sensor Status Alert only if problem */}
      {data.device && deviceStatus !== 'ONLINE' && (
        <Alert variant={deviceStatus === 'OFFLINE' ? 'destructive' : 'default'}>
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <AlertTitle>Peringatan Perangkat Sensor ({deviceStatus})</AlertTitle>
          <AlertDescription>
            Status perangkat sensor pada jalur ini adalah <strong>{deviceStatus}</strong> ({data.device.deviceCode || 'N/A'}). Harap periksa koneksi sebelum penghitungan.
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Section: Active Session or Line Ready Idle */}
      {activeSession ? (
        <Card className="border-primary/30 bg-card shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold">
                      Truk: {activeReceiving?.licensePlateSnapshot || '-'}
                    </CardTitle>
                    <StatusBadge tone="warning">Sedang dihitung</StatusBadge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    No. Surat Jalan: <span className="font-medium text-foreground">{activeReceiving?.deliveryNoteNumber || '-'}</span> • Supplier: <span className="font-medium text-foreground">{activeReceiving?.supplierNameSnapshot || '-'}</span> • Jalur: <span className="font-medium text-foreground">{data.line?.name || 'Jalur 01'}</span>
                  </CardDescription>
                </div>
              </div>
              <Button asChild size="default" className="w-full gap-2 sm:w-auto">
                <Link href="/active-session">
                  <Play className="size-4" />
                  <span>Buka Sesi Aktif</span>
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] lg:items-center">
              {/* Focal point: actual count is intentionally the dominant operational signal. */}
              <div className="flex flex-col items-center justify-center py-3 text-center lg:items-start lg:text-left">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Radio className="size-4 text-success motion-safe:animate-pulse" />
                  <span>Hasil sensor langsung</span>
                </div>
                <div className="my-1 font-heading text-6xl font-semibold tracking-tight tabular-nums text-foreground sm:text-7xl">
                  {actualCount.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-muted-foreground">Ekor ayam terdeteksi pada sesi ini</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeSession.lastDetection
                    ? `Deteksi terakhir ${new Date(activeSession.lastDetection).toLocaleTimeString('id-ID')}`
                    : 'Menunggu deteksi pertama'}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-5 gap-y-5 border-t pt-5 text-center lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-left">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Target manifest</dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                    {manifestCount.toLocaleString('id-ID')}
                  </dd>
                  <p className="text-xs text-muted-foreground">Ekor dari Surat Jalan</p>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Selisih berjalan</dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                    {progress.differenceLabel}
                  </dd>
                  <p className="text-xs text-muted-foreground">Status sementara</p>
                </div>
                <div className="col-span-2 border-t pt-4">
                  <dt className="text-xs font-medium text-muted-foreground">Perangkat sensor</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {data.device?.deviceCode || 'Belum terdaftar'}
                  </dd>
                  <p className="text-xs text-muted-foreground">Status perangkat tersedia pada header aplikasi</p>
                </div>
              </dl>
            </div>

            {/* Progress Bar with Overcount Support */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Kemajuan Terhadap Manifest</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {progress.progressLabel}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all duration-300 ${
                    progress.state === 'OVER'
                      ? 'bg-warning'
                      : progress.state === 'MATCHED'
                      ? 'bg-success'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${progress.barPercent}%` }}
                />
              </div>
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
                  <CardTitle className="text-lg">Jalur Siap Digunakan</CardTitle>
                  <CardDescription className="text-xs">
                    Tidak ada sesi penghitungan aktif di {data.line?.name || 'Jalur ini'}. Pilihlah truk dari antrean untuk memulai.
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
                    <p className="text-xs text-muted-foreground">Target Manifest</p>
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
                    <span>Mulai Penghitungan Truk Ini</span>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Antrean Menunggu</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="tabular-nums">
                  Total: {data.waitingQueueCount} Truk
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

        {/* Today's Detections Summary */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bird className="size-4 text-primary" />
                  <span>Ringkasan Deteksi Hari Ini</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Total event deteksi sensor produksi pada jalur ini ({data.line?.name || 'Jalur terhubung'}).
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-semibold tabular-nums px-2.5 py-1">
                Total: {totalDetectionsToday.toLocaleString('id-ID')} ekor
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {totalDetectionsToday === 0 ? (
              <EmptyState
                icon={Bird}
                title="Belum ada deteksi hari ini"
                description="Statistik deteksi terhubung sesi dan tanpa sesi akan diperbarui otomatis begitu sensor mendeteksi ayam."
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Assigned Box */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <StatusBadge tone="success">Terhubung Sesi</StatusBadge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {totalDetectionsToday > 0 ? Math.round((data.assignedDetections / totalDetectionsToday) * 100) : 0}%
                      </span>
                    </div>
                    <div>
                      <div className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                        {data.assignedDetections.toLocaleString('id-ID')}{' '}
                        <span className="text-xs font-normal text-muted-foreground">ekor</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Deteksi saat ada sesi counting aktif</p>
                    </div>
                  </div>

                  {/* Unassigned Box */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <StatusBadge tone={data.unassignedDetections > 0 ? 'warning' : 'neutral'}>Tanpa Sesi</StatusBadge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {totalDetectionsToday > 0 ? Math.round((data.unassignedDetections / totalDetectionsToday) * 100) : 0}%
                      </span>
                    </div>
                    <div>
                      <div className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                        {data.unassignedDetections.toLocaleString('id-ID')}{' '}
                        <span className="text-xs font-normal text-muted-foreground">ekor</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Deteksi di luar sesi counting aktif</p>
                    </div>
                  </div>
                </div>

                {/* Distribution Ratio Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="bg-success transition-all duration-300"
                      style={{
                        width: `${totalDetectionsToday > 0 ? Math.round((data.assignedDetections / totalDetectionsToday) * 100) : 0}%`,
                      }}
                    />
                    <div
                      className="bg-warning transition-all duration-300"
                      style={{
                        width: `${totalDetectionsToday > 0 ? Math.round((data.unassignedDetections / totalDetectionsToday) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{totalDetectionsToday > 0 ? Math.round((data.assignedDetections / totalDetectionsToday) * 100) : 0}% Terhubung Sesi</span>
                    <span>{totalDetectionsToday > 0 ? Math.round((data.unassignedDetections / totalDetectionsToday) * 100) : 0}% Tanpa Sesi</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alert for Unassigned Detections ONLY if > 0 */}
            {data.unassignedDetections > 0 && (
              <Alert className="text-xs border-warning/50 bg-warning/10 text-warning-foreground">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <AlertTitle className="text-xs font-semibold">Deteksi Tanpa Sesi ({data.unassignedDetections.toLocaleString('id-ID')} ekor)</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Terdapat deteksi sensor yang masuk saat tidak ada sesi aktif. Pastikan sesi dimulai sebelum penggantungan ayam dan diselesaikan tepat saat truk habis.
                  <div className="mt-2">
                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                      <Link href="/sensor-activity">Periksa Log Aktivitas Sensor</Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
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
