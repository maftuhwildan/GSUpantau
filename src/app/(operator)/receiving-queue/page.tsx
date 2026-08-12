'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QueueTable, ReceivingData } from '@/components/receiving/queue-table';
import { StartCountingDialog } from '@/components/receiving/start-counting-dialog';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function OperatorReceivingQueuePage() {
  const [receivings, setReceivings] = useState<ReceivingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [receivingToStart, setReceivingToStart] = useState<ReceivingData | null>(null);
  const { lastMessage } = useWebSocket();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // Fetch receivings for operator view
      const res = await fetch('/api/receivings');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal mengambil antrean Surat Jalan.');
      }

      // Filter to WAITING and COUNTING items for queue view
      const queueItems = (data.receivings || []).filter(
        (r: ReceivingData) => r.status === 'WAITING' || r.status === 'COUNTING'
      );

      setReceivings(queueItems);
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
      <PageHeader title="Antrean Surat Jalan" description="Pilih truck berstatus WAITING yang telah diterbitkan Admin untuk mulai proses penghitungan." actions={<>
          <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <StatusBadge tone="success">Jalur Operasional Aktif</StatusBadge>
        </>} />

      {/* Operator Restrictions Banner */}
      <Alert>
        <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
        <AlertTitle>Batas Wewenang Operator</AlertTitle>
        <AlertDescription>Operator dapat memulai (<em>Start Counting</em>) truck berstatus WAITING. Pembuatan, penerbitan, atau revisi data Surat Jalan hanya dapat dilakukan oleh Admin.</AlertDescription>
      </Alert>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Queue Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Daftar Antrean Truck Berjalan
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Truck berstatus WAITING disusun berdasarkan posisi antrean.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <QueueTable
            receivings={receivings}
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
