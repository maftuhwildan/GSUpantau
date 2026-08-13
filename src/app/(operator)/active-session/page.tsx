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
import { Radio, PlayCircle, Layers, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@/components/layout/ws-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OperatorActiveSessionPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Array<{ id: string; name: string; lineCode: string }>>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [linesLoading, setLinesLoading] = useState(true);
  const [sessionDetail, setSessionDetail] = useState<ActiveSessionDetail | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  // Fetch available lines for user
  useEffect(() => {
    async function fetchLines() {
      try {
        setLinesLoading(true);
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
      } finally {
        setLinesLoading(false);
      }
    }
    fetchLines();
  }, []);

  // Fetch active session for selected line
  const fetchActiveSession = useCallback(async () => {
    if (!selectedLineId) return;
    setSessionLoading(true);
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
      setSessionLoading(false);
    }
  }, [selectedLineId]);

  useEffect(() => {
    if (selectedLineId) {
      fetchActiveSession();

      // Auto polling every 3 seconds for realtime updates
      const timer = setInterval(() => {
        fetchActiveSession();
      }, 3000);

      return () => clearInterval(timer);
    }
  }, [selectedLineId, fetchActiveSession]);

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

  const initialLoading = linesLoading || (selectedLineId !== null && sessionLoading && sessionDetail === null);

  const activeLine = lines.find((l) => l.id === selectedLineId) || lines[0] || null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Sesi Counting Aktif"
        description="Pantau hitungan sensor ESP32 dan selesaikan sesi operasional."
        actions={
          <>
            {initialLoading ? (
              <StatusBadge tone="neutral">MEMUAT</StatusBadge>
            ) : sessionDetail ? (
              <StatusBadge tone="warning">COUNTING</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">IDLE / SIAP</StatusBadge>
            )}

            {/* Line Selection / Non-interactive Badge */}
            {lines.length === 1 ? (
              <Badge variant="outline" className="gap-1.5 py-1 text-xs">
                <Layers className="size-3.5 text-primary" />
                <span>Jalur: {lines[0].name} ({lines[0].lineCode})</span>
              </Badge>
            ) : lines.length > 1 ? (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
              </div>
            ) : null}
          </>
        }
      />

      {/* Main Content Area */}
      {initialLoading ? (
        <LoadingState label="Memuat informasi sesi aktif..." rows={4} />
      ) : lines.length === 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>
            Anda belum ditugaskan pada jalur (Line) mana pun. Hubungi Administrator untuk penugasan jalur.
          </AlertDescription>
        </Alert>
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
          title={`Jalur ${activeLine?.name || ''} sedang tidak memiliki sesi aktif`}
          description="Tidak ada proses penghitungan truck yang sedang berjalan. Mulai sesi dari antrean Surat Jalan yang tersedia."
          action={
            <Button asChild>
              <Link href="/receiving-queue">
                <PlayCircle className="h-4 w-4" />
                <span>Pilih dari Antrean Surat Jalan</span>
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
