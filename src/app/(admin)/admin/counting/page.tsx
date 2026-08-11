'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CountingConsole, ActiveSessionDetail } from '@/components/receiving/counting-console';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Radio, AlertCircle, PlayCircle, Layers, ShieldCheck } from 'lucide-react';
import { useWebSocket } from '@/components/layout/ws-provider';

export default function AdminCountingPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Array<{ id: string; name: string; lineCode: string }>>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<ActiveSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  // Fetch lines
  useEffect(() => {
    async function fetchLines() {
      try {
        const res = await fetch('/api/lines');
        if (res.ok) {
          const json = await res.json();
          if (json.lines && json.lines.length > 0) {
            setLines(json.lines);
            setSelectedLineId(json.lines[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching lines:', err);
      }
    }
    fetchLines();
  }, []);

  // Fetch active session
  const fetchActiveSession = useCallback(async () => {
    if (!selectedLineId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/lines/${selectedLineId}/active-session`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Gagal mengambil data sesi aktif');
      }

      const json = await res.json();
      setSessionDetail(json.activeSession);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => {
    fetchActiveSession();

    const timer = setInterval(() => {
      fetchActiveSession();
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchActiveSession]);

  useEffect(() => {
    if (!lastMessage) return;

    const type = lastMessage.type;
    if (
      type === 'session.started' ||
      type === 'session.counter_updated' ||
      type === 'session.finished' ||
      type === 'session.cancelled' ||
      type === 'device.heartbeat_received' ||
      type === 'device.status_updated' ||
      type === 'realtime.reconnected' ||
      type === 'realtime.poll'
    ) {
      fetchActiveSession();
    }
  }, [lastMessage, fetchActiveSession]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background dark:bg-card p-6 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Penghitungan Admin (Counting Console)</h1>
            <StatusBadge tone="primary">
              <ShieldCheck className="h-3 w-3 mr-1" /> Full Access
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Admin memiliki wewenang penuh untuk memantau, menyelesaikan, atau membatalkan sesi counting di semua Line.
          </p>
        </div>

        {/* Line Switcher */}
        {lines.length > 0 && (
          <div className="flex items-center gap-2 bg-muted  p-1.5 rounded-lg border">
            <Layers className="h-4 w-4 text-muted-foreground ml-1.5" />
            <span className="text-xs font-semibold text-muted-foreground ">Jalur:</span>
            <ToggleGroup
              type="single"
              value={selectedLineId || undefined}
              onValueChange={(value) => value && setSelectedLineId(value)}
              variant="outline"
              spacing={0}
              aria-label="Pilih jalur counting"
            >
              {lines.map((l) => (
                <ToggleGroupItem
                  key={l.id}
                  value={l.id}
                  aria-label={`Pilih ${l.name}`}
                  className="h-11 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:h-8"
                >
                  {l.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* Main Area */}
      {loading && !sessionDetail ? (
        <LoadingState label="Memuat informasi sesi aktif" rows={4} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchActiveSession} />
      ) : sessionDetail ? (
        <CountingConsole
          session={sessionDetail}
          isAdmin={true}
          onFinishSuccess={() => {
            fetchActiveSession();
            router.refresh();
          }}
          onCancelSuccess={() => {
            fetchActiveSession();
            router.refresh();
          }}
        />
      ) : (
        <Card className="border-dashed border-2 p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10  flex items-center justify-center text-primary">
            <Radio className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Jalur Ini Sedang Tidak Memiliki Sesi Aktif</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Tidak ada proses penghitungan truk yang sedang berjalan di jalur ini.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild className="bg-primary hover:bg-primary text-primary-foreground text-xs gap-2">
              <Link href="/admin/receiving">
                <PlayCircle className="h-4 w-4" />
                <span>Buka Manajemen & Queue Surat Jalan</span>
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
