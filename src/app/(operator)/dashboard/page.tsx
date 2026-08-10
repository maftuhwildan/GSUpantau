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
import { useWebSocket } from '@/components/layout/ws-provider';

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
    return <div className="p-6 text-center text-muted-foreground"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  if (errorMsg) {
    return <div className="p-6 text-center text-red-600 font-medium">{errorMsg}</div>;
  }

  if (!data) return null;

  const deviceStatus = data.device?.status || 'UNKNOWN';
  const deviceStatusTone =
    deviceStatus === 'ONLINE'
      ? 'text-emerald-700 dark:text-emerald-400'
      : deviceStatus === 'DEGRADED'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-red-700 dark:text-red-400';
  const deviceStatusDot =
    deviceStatus === 'ONLINE'
      ? 'bg-emerald-500 animate-ping'
      : deviceStatus === 'DEGRADED'
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="space-y-6">
      {/* Top Banner / Line Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Dashboard Operator • {data.line?.name || 'Belum ada Line'}
            </h1>
            <Badge variant={data.activeSession ? 'success' : 'secondary'}>
              {data.activeSession ? 'Sesi Aktif' : 'IDLE'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pantau status penghitungan truck penerimaan ayam secara realtime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/receiving-queue">
              <Layers className="h-4 w-4 text-purple-600" />
              <span>Lihat Antrean ({data.waitingQueue.length})</span>
            </Link>
          </Button>

          {data.activeSession && (
            <Button size="sm" asChild className="bg-purple-600 hover:bg-purple-500 gap-1.5">
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
        <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 dark:from-card dark:to-purple-950/20 shadow-md">
          <CardHeader className="pb-3 border-b border-purple-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-600 text-white">
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
              <Badge variant="warning" className="animate-pulse">
                COUNTING
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">Manifest (Surat Jalan)</p>
                <p className="text-3xl font-extrabold text-foreground mt-1">
                  {data.activeSession.receiving?.manifestCount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Ekor Terdaftar</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-600 text-white shadow-md relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-medium text-purple-100">Hitung Realtime (Sensor)</p>
                  <Radio className="h-4 w-4 animate-pulse text-pink-300" />
                </div>
                <p className="text-3xl font-extrabold mt-1 tracking-tight">
                  {(data.activeSession.actualCount || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-purple-200 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Deteksi terakhir:{' '}
                  {data.activeSession.lastDetection
                    ? new Date(data.activeSession.lastDetection).toLocaleTimeString()
                    : 'Belum ada'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">Selisih Sementara</p>
                <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                  {((data.activeSession.actualCount || 0) - (data.activeSession.receiving?.manifestCount || 0)).toLocaleString()}
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 font-medium">
                  Proses Belum Selesai
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm flex flex-col justify-between">
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
              <Button variant="default" asChild className="bg-purple-600 hover:bg-purple-500 gap-2">
                <Link href="/active-session">
                  <span>Kelola & Selesaikan Sesi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border p-12 text-center bg-slate-50 dark:bg-slate-900 border-dashed">
          <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Tidak Ada Sesi Aktif</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-6">Line ini sedang idle. Buka antrean untuk memulai penghitungan truck berikutnya.</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-500">
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
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{item.licensePlateSnapshot}</span>
                      <span className="text-muted-foreground">({item.deliveryNoteNumber})</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{item.supplierNameSnapshot}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-700 dark:text-purple-400">{item.manifestCount.toLocaleString()} ekor</p>
                    <span className="text-[10px] text-slate-400">Siap Dihitung</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bird className="h-4 w-4 text-purple-600" />
              <span>Ringkasan Deteksi Hari Ini</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-muted-foreground font-medium">Assigned Deteksi</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {data.assignedDetections.toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Terhubung ke session
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <p className="text-amber-800 dark:text-amber-400 font-medium">Unassigned Deteksi</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-1">
                  {data.unassignedDetections.toLocaleString()}
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Di luar sesi aktif
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-300 text-[11px] leading-relaxed">
              <strong>Aturan SOP Batas Truck:</strong> Pastikan truck yang sedang dihitung benar-benar selesai dan proses penggantungan berhenti sebelum menyelesaikan sesi agar deteksi berikutnya tidak menjadi <em>unassigned</em>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
