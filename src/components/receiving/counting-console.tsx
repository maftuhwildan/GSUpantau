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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
      ? 'text-emerald-600'
      : deviceStatus === 'DEGRADED'
      ? 'text-amber-600'
      : 'text-red-600';

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
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg(null)} className="h-6 text-[10px]">
            Tutup
          </Button>
        </div>
      )}

      {/* Main Console Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Left 2 Columns: Counter Display & Finish SOP */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg ring-1 ring-primary/15">
            <CardHeader className="rounded-t-[inherit] bg-foreground text-background">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">
                      Truck: {receiving?.licensePlateSnapshot || '-'}
                    </CardTitle>
                    <CardDescription className="text-xs text-background/70">
                      Surat Jalan: {receiving?.deliveryNoteNumber || '-'} • Line: {session.lineName || session.lineCode || 'Line 01'}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge tone="warning" className="animate-pulse">
                    COUNTING
                  </StatusBadge>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCancelDialog(true)}
                      className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-slate-800"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Batal Sesi
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Realtime Counter Comparison */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                {/* Target Manifest Box */}
                <div className="space-y-1 rounded-2xl border bg-muted/60 p-5 text-center sm:p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target Manifest (Surat Jalan)
                  </span>
                  <div className="font-heading text-4xl font-black text-foreground sm:text-5xl">
                    {manifest.toLocaleString('id-ID')}
                  </div>
                  <span className="text-xs text-muted-foreground">Ekor Ayam</span>
                </div>

                {/* Actual Sensor Box */}
                <div className="relative space-y-1 overflow-hidden rounded-2xl bg-primary p-5 text-center text-primary-foreground shadow-md sm:p-6">
                  <span className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    Actual Hitung Sensor
                  </span>
                  <div className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
                    {actual.toLocaleString('id-ID')}
                  </div>
                  <span className="flex items-center justify-center gap-1 text-xs text-primary-foreground/80">
                    <Clock className="h-3.5 w-3.5" />
                    {session.lastDetection
                      ? `Terakhir: ${new Date(session.lastDetection.receivedAt!).toLocaleTimeString('id-ID')}`
                      : 'Menunggu deteksi pertama...'}
                  </span>
                </div>
              </div>

              {/* Progress & Variance Indicator */}
              <div className="flex items-center justify-between rounded-xl border border-warning/25 bg-warning/10 p-4">
                <div>
                  <p className="text-xs font-semibold text-warning-foreground">
                    Selisih Berjalan (Variance):
                  </p>
                  <p className="text-2xl font-extrabold text-warning-foreground">
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
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2 text-pink-400 font-semibold text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Peringatan SOP Penyelesaian Counting</span>
                </div>
                <p className="leading-relaxed bg-black/40 p-3 rounded border border-white/10 text-pink-200 font-medium">
                  &quot;Pastikan truck ini sudah habis dan proses line sudah berhenti sebelum menyelesaikan counting.&quot;
                </p>
                <p className="text-[11px] text-slate-400">
                  Deteksi sensor setelah tombol Selesai ditekan akan otomatis disimpan sebagai status{' '}
                  <strong className="text-amber-300">UNASSIGNED</strong>.
                </p>
              </div>

              {/* Stale / Offline Sensor Warning Warning Box near finish */}
              {isSensorOfflineOrStale && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Peringatan Status Sensor ({deviceStatus})</p>
                    <p className="text-[11px] mt-0.5 text-red-600 dark:text-red-300 leading-relaxed">
                      Sensor di jalur ini berstatus <strong>{deviceStatus}</strong> atau koneksi heartbeat tidak merespons. Harap pastikan jaringan sensor tidak terputus sebelum menyelesaikan penghitungan.
                    </p>
                  </div>
                </div>
              )}

              {/* Primary Finish Button */}
              <div className="hidden pt-2 md:block">
                <Button
                  onClick={() => setShowFinishDialog(true)}
                  disabled={submitting}
                  className="h-12 w-full gap-2 text-base font-bold shadow-lg"
                >
                  <Square className="h-5 w-5 fill-current" />
                  <span>SELESAIKAN COUNTING TRUCK INI</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column: Receiving Details & Recent Detection Logs */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informasi Detail Receiving</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-semibold text-foreground">{receiving?.supplierNameSnapshot || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Supir:</span>
                <span className="font-semibold text-foreground">{receiving?.driverNameSnapshot || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">No. Surat Jalan:</span>
                <span className="font-mono text-foreground">{receiving?.deliveryNoteNumber || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Waktu Mulai:</span>
                <span className="font-semibold text-foreground">
                  {new Date(session.startedAt).toLocaleTimeString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Status Device:</span>
                <span className={`font-semibold flex items-center gap-1 ${deviceStatusTone}`}>
                  <Radio className="h-3 w-3 animate-pulse" />
                  {deviceStatus}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Heartbeat Terakhir:</span>
                <span className="font-semibold text-foreground">
                  {session.deviceStatus?.lastHeartbeatAt
                    ? new Date(session.deviceStatus.lastHeartbeatAt).toLocaleTimeString('id-ID')
                    : 'Belum ada'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-purple-600" />
                  Log Deteksi Terbaru
                </span>
                <Badge variant="outline" className="text-[10px]">Realtime</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.recentDetections && session.recentDetections.length > 0 ? (
                <div className="space-y-2">
                  {session.recentDetections.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-bold text-foreground">+1 Ekor</span>
                        <span className="text-slate-400">(Seq #{log.sequence})</span>
                      </div>
                      <span className="text-muted-foreground font-mono">
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

      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur-sm md:hidden">
        <Button
          onClick={() => setShowFinishDialog(true)}
          disabled={submitting}
          className="h-12 w-full gap-2 font-bold shadow-lg"
        >
          <Square className="fill-current" />
          Selesaikan Counting
        </Button>
      </div>

      {/* Dialog Konfirmasi Penyelesaian */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Konfirmasi Selesaikan Counting
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed">
              Apakah Anda yakin ingin menyelesaikan penghitungan untuk Surat Jalan{' '}
              <strong className="text-foreground">{receiving?.deliveryNoteNumber}</strong> (Plat:{' '}
              <strong className="text-foreground">{receiving?.licensePlateSnapshot}</strong>)?
            </DialogDescription>
          </DialogHeader>

          {isSensorOfflineOrStale && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 my-1">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <strong>Peringatan Sensor ({deviceStatus}):</strong> Sensor jalur ini dalam kondisi offline/stale. Pastikan koneksi fisik sensor aman sebelum menyelesaikan.
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs space-y-1.5 my-2 border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Manifest:</span>
              <span className="font-bold">{manifest.toLocaleString('id-ID')} ekor</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Hitung:</span>
              <span className="font-bold text-purple-600">{actual.toLocaleString('id-ID')} ekor</span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground">Selisih Akhir:</span>
              <span className={`font-bold ${difference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {difference > 0 ? `+${difference}` : difference} ekor
                {diffPercent !== null && ` (${diffPercent}%)`}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200">
            <strong>Catatan SOP:</strong> Pastikan truck sudah kosong dan proses penggantungan ayam telah selesai. Sesi yang telah diselesaikan tidak dapat dibuka kembali.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowFinishDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleFinish} disabled={submitting} className="bg-rose-600 hover:bg-rose-500 text-white">
              {submitting ? 'Memproses...' : 'Ya, Selesaikan Counting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Batal Sesi (Admin Only) */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Batalkan Sesi Counting
            </DialogTitle>
            <DialogDescription className="text-xs pt-2">
              Membatalkan sesi akan mengembalikan status Surat Jalan ini ke status <strong>WAITING</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <Label htmlFor="cancel-counting-reason" className="font-semibold text-foreground">
              Alasan Pembatalan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="cancel-counting-reason"
              className="min-h-24 text-xs"
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
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {submitting ? 'Memproses...' : 'Batalkan Sesi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
