'use client';

import { useState } from 'react';
import {
  Truck,
  Square,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ActiveSessionDetail {
  id: string;
  status: string;
  startedAt: string | Date;
  startedBy?: string;
  lineId: string;
  lineName?: string;
  lineCode?: string;
  receiving: {
    id: string;
    receivingNumber: string;
    deliveryNoteNumber: string;
    licensePlateSnapshot: string;
    driverNameSnapshot: string;
    supplierNameSnapshot: string;
    manifestCount: number;
    notes?: string | null;
  } | null;
  actualCount: number;
  differenceCount: number;
  differencePercent: number | null;
  lastDetection?: {
    id?: string;
    sequence?: number;
    receivedAt?: string | Date;
  } | null;
  recentDetections?: Array<{
    id: string;
    sequence: number;
    receivedAt: string | Date;
    status: string;
  }>;
  deviceStatus?: {
    id?: string;
    deviceCode?: string;
    name?: string;
    status?: string;
    lastHeartbeatAt?: string | Date | null;
  } | null;
}

interface CountingConsoleProps {
  session: ActiveSessionDetail;
  isAdmin?: boolean;
  onFinishSuccess?: (result: { actualCount: number; differenceCount: number }) => void;
  onCancelSuccess?: () => void;
}

export function CountingConsole({
  session,
  isAdmin = false,
  onFinishSuccess,
  onCancelSuccess,
}: CountingConsoleProps) {
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const receiving = session.receiving;
  const manifest = receiving?.manifestCount ?? 0;
  const actual = session.actualCount;
  const difference = session.differenceCount;
  const diffPercent = session.differencePercent;
  const deviceStatus = session.deviceStatus?.status || 'UNKNOWN';
  const deviceStatusTone =
    deviceStatus === 'ONLINE'
      ? 'text-device-online'
      : deviceStatus === 'DEGRADED'
      ? 'text-device-degraded'
      : deviceStatus === 'OFFLINE'
      ? 'text-device-offline'
      : 'text-device-unknown';

  const isSensorOfflineOrStale =
    deviceStatus !== 'ONLINE' ||
    (session.deviceStatus?.lastHeartbeatAt
      ? new Date().getTime() - new Date(session.deviceStatus.lastHeartbeatAt).getTime() > 30000
      : true);

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: true }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Gagal menyelesaikan sesi counting');
      }

      setShowFinishDialog(false);
      if (onFinishSuccess) {
        onFinishSuccess({
          actualCount: json.session.actual_count,
          differenceCount: json.session.difference_count,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    if (submitting) return;
    if (!cancelReason.trim()) {
      setErrorMsg('Alasan pembatalan sesi wajib diisi.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Gagal membatalkan sesi counting');
      }

      setShowCancelDialog(false);
      if (onCancelSuccess) {
        onCancelSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error alert */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="sm" onClick={() => setErrorMsg(null)} className="h-6">
              Tutup
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Main Console Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Left 2 Columns: Counter Display & Finish SOP */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>
                      Truck: {receiving?.licensePlateSnapshot || '-'}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Surat Jalan: {receiving?.deliveryNoteNumber || '-'} • Line: {session.lineName || session.lineCode || 'Line 01'}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge tone="warning">
                    <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                    COUNTING
                  </StatusBadge>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowCancelDialog(true)}
                      className="min-h-11 sm:min-h-0"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Batal Sesi
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Realtime Counter Comparison */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-0">
                {/* Target Manifest Box */}
                <div className="flex flex-col items-center gap-1 text-center sm:px-6">
                  <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-info/10 text-info">
                    <Square className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Target manifest</span>
                  <div className="font-heading text-4xl font-semibold tabular-nums sm:text-5xl">
                    {manifest.toLocaleString('id-ID')}
                  </div>
                  <span className="text-xs text-muted-foreground">Ekor ayam dari Surat Jalan</span>
                </div>

                {/* Actual Sensor Box */}
                <div className="flex flex-col items-center gap-1 border-t pt-6 text-center sm:border-l sm:border-t-0 sm:px-6 sm:pt-0">
                  <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <Radio className="size-4 animate-pulse" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Actual hitung sensor</span>
                  <div className="font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                    {actual.toLocaleString('id-ID')}
                  </div>
                  <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    {session.lastDetection
                      ? `Terakhir: ${new Date(session.lastDetection.receivedAt!).toLocaleTimeString('id-ID')}`
                      : 'Menunggu deteksi pertama...'}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Progress & Variance Indicator */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Selisih berjalan</p>
                  <p className="font-heading text-2xl font-semibold tabular-nums">
                    {difference > 0 ? `+${difference.toLocaleString('id-ID')}` : difference.toLocaleString('id-ID')}{' '}
                    ekor{' '}
                    {diffPercent !== null && (
                      <span className="text-xs font-normal">
                        ({diffPercent > 0 ? `+${diffPercent}` : diffPercent}%)
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge tone="warning">BELUM SELESAI</StatusBadge>
              </div>

              {/* Critical SOP Warning Box */}
              <Alert>
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <AlertTitle>Peringatan SOP Penyelesaian Counting</AlertTitle>
                <AlertDescription className="space-y-1 mt-1">
                  <p className="font-medium text-foreground">
                    &quot;Pastikan truck ini sudah habis dan proses line sudah berhenti sebelum menyelesaikan counting.&quot;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deteksi sensor setelah tombol Selesai ditekan akan otomatis disimpan sebagai status{' '}
                    <strong className="font-medium text-foreground">UNASSIGNED</strong>.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Stale / Offline Sensor Warning Warning Box near finish */}
              {isSensorOfflineOrStale && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <AlertTitle>Peringatan Status Sensor ({deviceStatus})</AlertTitle>
                  <AlertDescription>
                    Sensor di jalur ini berstatus <strong>{deviceStatus}</strong> atau koneksi heartbeat tidak merespons. Harap pastikan jaringan sensor tidak terputus sebelum menyelesaikan penghitungan.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="hidden justify-end border-t md:flex">
              <Button onClick={() => setShowFinishDialog(true)} disabled={submitting} size="lg">
                <Square className="size-4 fill-current" />
                Selesaikan counting
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right 1 Column: Receiving Details & Recent Detection Logs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi receiving</CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-xs">
              <div className="flex justify-between gap-4 py-2 first:pt-0">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="text-right font-medium">{receiving?.supplierNameSnapshot || '-'}</span>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted-foreground">Supir:</span>
                <span className="text-right font-medium">{receiving?.driverNameSnapshot || '-'}</span>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted-foreground">No. Surat Jalan:</span>
                <span className="text-right font-medium">{receiving?.deliveryNoteNumber || '-'}</span>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted-foreground">Waktu Mulai:</span>
                <span className="text-right font-medium tabular-nums">
                  {new Date(session.startedAt).toLocaleTimeString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <span className="text-muted-foreground">Status Device:</span>
                <span className={`flex items-center gap-1 font-medium ${deviceStatusTone}`}>
                  <Radio className="h-3 w-3 animate-pulse shrink-0" />
                  {deviceStatus}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-2 last:pb-0">
                <span className="text-muted-foreground">Heartbeat Terakhir:</span>
                <span className="text-right font-medium tabular-nums">
                  {session.deviceStatus?.lastHeartbeatAt
                    ? new Date(session.deviceStatus.lastHeartbeatAt).toLocaleTimeString('id-ID')
                    : 'Belum ada'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary shrink-0" />
                  Log Deteksi Terbaru
                </span>
                <Badge variant="outline">Realtime</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.recentDetections && session.recentDetections.length > 0 ? (
                <div className="divide-y">
                  {session.recentDetections.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="font-medium text-foreground">+1 ekor</span>
                        <span className="text-muted-foreground">(Seq #{log.sequence})</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(log.receivedAt).toLocaleTimeString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                  Belum ada deteksi sensor untuk sesi ini
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-sm md:hidden">
        <Button
          onClick={() => setShowFinishDialog(true)}
          disabled={submitting}
          size="lg"
          className="h-12 w-full text-base"
        >
          <Square className="h-5 w-5 fill-current shrink-0" />
          <span>Selesaikan Counting</span>
        </Button>
      </div>

      {/* Dialog Konfirmasi Penyelesaian */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              Konfirmasi Selesaikan Counting
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed text-muted-foreground">
              Apakah Anda yakin ingin menyelesaikan penghitungan untuk Surat Jalan{' '}
              <strong className="text-foreground">{receiving?.deliveryNoteNumber}</strong> (Plat:{' '}
              <strong className="text-foreground">{receiving?.licensePlateSnapshot}</strong>)?
            </DialogDescription>
          </DialogHeader>

          {isSensorOfflineOrStale && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <AlertTitle>Peringatan Sensor ({deviceStatus})</AlertTitle>
              <AlertDescription>Sensor jalur ini dalam kondisi offline/stale. Pastikan koneksi fisik sensor aman sebelum menyelesaikan.</AlertDescription>
            </Alert>
          )}

          <Card size="sm">
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Target manifest</span>
                <span className="font-medium tabular-nums">{manifest.toLocaleString('id-ID')} ekor</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Actual hitung</span>
                <span className="font-medium tabular-nums">{actual.toLocaleString('id-ID')} ekor</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Selisih akhir</span>
                <span className="font-medium tabular-nums">
                  {difference > 0 ? `+${difference}` : difference} ekor
                  {diffPercent !== null && ` (${diffPercent}%)`}
                </span>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="size-4 text-warning" />
            <AlertTitle>Catatan SOP</AlertTitle>
            <AlertDescription>Pastikan truck sudah kosong dan proses penggantungan ayam telah selesai. Sesi yang telah diselesaikan tidak dapat dibuka kembali.</AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowFinishDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleFinish} disabled={submitting}>
              {submitting ? 'Memproses...' : 'Ya, Selesaikan Counting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Batal Sesi (Admin Only) */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              Batalkan Sesi Counting
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 text-muted-foreground">
              Membatalkan sesi akan mengembalikan status Surat Jalan ini ke status <strong>WAITING</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <Label htmlFor="cancel-counting-reason">
              Alasan Pembatalan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-counting-reason"
              className="min-h-24"
              placeholder="Contoh: Kesalahan pemilihan jalur atau truk fisik belum tiba"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              onClick={handleCancelSession}
              disabled={submitting || !cancelReason.trim()}
              variant="destructive"
            >
              {submitting ? 'Memproses...' : 'Batalkan Sesi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
