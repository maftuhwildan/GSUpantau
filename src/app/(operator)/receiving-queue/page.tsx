'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QueueTable, ReceivingData } from '@/components/receiving/queue-table';

export default function OperatorReceivingQueuePage() {
  const [receivings, setReceivings] = useState<ReceivingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Antrean Surat Jalan (Receiving Queue)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih truck dari daftar antrean yang telah diterbitkan (WAITING) oleh Admin untuk mulai proses penghitungan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchQueue} className="text-xs gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Badge variant="outline" className="text-purple-700 bg-purple-50">
            Jalur Operasional Active
          </Badge>
        </div>
      </div>

      {/* Operator Restrictions Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Batas Wewenang Operator:</strong> Operator dapat memulai (<em>Start Counting</em>) truck berstatus WAITING. Pembuatan, penerbitan, atau revisi data Surat Jalan hanya dapat dilakukan oleh Admin.
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Queue Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
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
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
