'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CountingConsole, ActiveSessionDetail } from '@/components/receiving/counting-console';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Radio, PlayCircle, Layers } from 'lucide-react';
import { useWebSocket } from '@/components/layout/ws-provider';

export default function OperatorActiveSessionPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Array<{ id: string; name: string; lineCode: string }>>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<ActiveSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  // Fetch available lines
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

  // Fetch active session for selected line
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

    // Auto polling every 3 seconds for realtime updates
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
      <PageHeader
        title="Sesi Counting Aktif"
        description="Pantau hitungan sensor ESP32 dan selesaikan sesi operasional."
        actions={<>
          {sessionDetail ? <StatusBadge tone="warning"><span className="size-2 rounded-full bg-warning" />COUNTING</StatusBadge> : <StatusBadge tone="neutral">IDLE / SIAP</StatusBadge>}
          {lines.length > 0 ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Layers className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Jalur:</span>
            <ToggleGroup
              type="single"
              value={selectedLineId || undefined}
              onValueChange={(value) => value && setSelectedLineId(value)}
              variant="outline"
              spacing={2}
              aria-label="Pilih jalur counting"
              className="w-full flex-wrap sm:w-fit"
            >
              {lines.map((l) => (
                <ToggleGroupItem
                  key={l.id}
                  value={l.id}
                  aria-label={`Pilih ${l.name}`}
                  className="min-w-11 flex-1 px-3 text-xs sm:flex-none"
                >
                  {l.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div> : null}
        </>}
      />

      {/* Main Content Area */}
      {loading && !sessionDetail ? (
        <LoadingState label="Memuat informasi sesi aktif" rows={4} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchActiveSession} />
      ) : sessionDetail ? (
        <CountingConsole
          session={sessionDetail}
          isAdmin={false}
          onFinishSuccess={() => {
            fetchActiveSession();
            router.refresh();
          }}
        />
      ) : (
        <EmptyState
          icon={Radio}
          title="Jalur ini sedang tidak memiliki sesi aktif"
          description="Tidak ada proses penghitungan truck yang sedang berjalan. Mulai sesi dari antrean Surat Jalan yang tersedia."
          action={
            <Button asChild>
              <Link href="/operator/receiving-queue">
                <PlayCircle className="h-4 w-4" />
                <span>Pilih dari antrean Surat Jalan</span>
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
