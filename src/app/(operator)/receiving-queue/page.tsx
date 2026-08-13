'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Layers, ShieldAlert, RefreshCw, AlertCircle, Play, Truck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { QueueTable, ReceivingData } from '@/components/receiving/queue-table';
import { StartCountingDialog } from '@/components/receiving/start-counting-dialog';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function OperatorReceivingQueuePage() {
  const [countingReceiving, setCountingReceiving] = useState<ReceivingData | null>(null);
  const [waitingReceivings, setWaitingReceivings] = useState<ReceivingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [receivingToStart, setReceivingToStart] = useState<ReceivingData | null>(null);
  const { lastMessage } = useWebSocket();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // Fetch receivings for operator view (line-scoped by backend)
      const res = await fetch('/api/receivings');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal mengambil antrean Surat Jalan.');
      }

      const allReceivings: ReceivingData[] = data.receivings || [];

      // Separate active COUNTING receiving from WAITING items
      const activeItem = allReceivings.find((r) => r.status === 'COUNTING') || null;
      const waitingItems = allReceivings.filter((r) => r.status === 'WAITING');

      setCountingReceiving(activeItem);
      setWaitingReceivings(waitingItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!lastMessage) return;

    const type = lastMessage.type;
    if (
      type === 'session.started' ||
      type === 'session.finished' ||
      type === 'session.cancelled' ||
      type === 'receiving.queue_updated' ||
      type === 'realtime.reconnected' ||
      type === 'realtime.poll'
    ) {
      fetchQueue();
    }
  }, [lastMessage, fetchQueue]);

  const handleStartPrompt = (receiving: ReceivingData) => {
    setReceivingToStart(receiving);
    setStartDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Antrean Surat Jalan"
        description="Pilih truck berstatus WAITING yang telah diterbitkan Admin untuk mulai proses penghitungan."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-1.5 min-h-[44px] sm:min-h-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <StatusBadge tone="success">Jalur Operasional Aktif</StatusBadge>
          </>
        }
      />

      {/* Secondary Authority Boundary Information */}
      <Alert className="py-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
        <AlertTitle className="text-xs font-semibold">Batas Wewenang Operator</AlertTitle>
        <AlertDescription className="text-xs">
          Operator dapat memulai (<em>Start Counting</em>) truck berstatus WAITING. Pembuatan atau revisi data Surat Jalan dilakukan oleh Admin.
        </AlertDescription>
      </Alert>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Separate Context Panel for COUNTING Receiving */}
      {countingReceiving && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3 border-b border-warning/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
                  <Truck className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sedang Dihitung</span>
                    <StatusBadge tone="warning">COUNTING</StatusBadge>
                  </div>
                  <CardTitle className="text-lg mt-0.5">
                    {countingReceiving.licensePlateSnapshot}
                  </CardTitle>
                </div>
              </div>
              <Button asChild size="sm" className="gap-2 min-h-[44px] sm:min-h-0">
                <Link href="/active-session">
                  <Play className="size-4" />
                  <span>Buka Sesi Aktif</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">No. Surat Jalan</p>
                <p className="font-semibold text-foreground">{countingReceiving.deliveryNoteNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-semibold text-foreground">{countingReceiving.supplierNameSnapshot}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Manifest</p>
                <p className="font-semibold tabular-nums text-foreground">{countingReceiving.manifestCount.toLocaleString('id-ID')} ekor</p>
              </div>
              <div>
                <p className="text-muted-foreground">Jalur</p>
                <p className="font-semibold text-foreground">{countingReceiving.lineName || 'Jalur Operasional'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Table / Card List for WAITING Receivings */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Daftar Antrean Truck Menunggu ({waitingReceivings.length})
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Truck berstatus WAITING disusun berdasarkan urutan posisi antrean.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <QueueTable
            receivings={waitingReceivings}
            isAdmin={false}
            onStart={handleStartPrompt}
            loading={loading}
          />
        </CardContent>
      </Card>

      <StartCountingDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        receivingId={receivingToStart?.id || null}
        deliveryNoteNumber={receivingToStart?.deliveryNoteNumber || ''}
        isAdmin={false}
      />
    </div>
  );
}
