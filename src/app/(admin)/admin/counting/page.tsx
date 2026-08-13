'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CountingConsole, ActiveSessionDetail } from '@/components/receiving/counting-console';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Radio, PlayCircle, ShieldCheck } from 'lucide-react';
import { useWebSocket } from '@/components/layout/ws-provider';

interface CountingLine {
  id: string;
  name: string;
  lineCode: string;
}

interface LineSessionState {
  session: ActiveSessionDetail | null;
  loading: boolean;
  error: string | null;
}

function AdminCountingContent() {
  const searchParams = useSearchParams();
  const urlLineId = searchParams.get('line_id');

  const [lines, setLines] = useState<CountingLine[]>([]);
  const [sessionsByLine, setSessionsByLine] = useState<Record<string, LineSessionState>>({});
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesError, setLinesError] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  const fetchLines = useCallback(async () => {
    setLinesLoading(true);
    setLinesError(null);
    try {
      const res = await fetch('/api/lines');
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Gagal mengambil daftar line');
      }

      const json = await res.json();
      setLines(json.lines || []);
    } catch (err: unknown) {
      setLinesError(err instanceof Error ? err.message : 'Terjadi kesalahan server');
    } finally {
      setLinesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const fetchActiveSessions = useCallback(async () => {
    if (lines.length === 0) return;

    setSessionsByLine((current) => Object.fromEntries(
      lines.map((line) => [
        line.id,
        current[line.id] || { session: null, loading: true, error: null },
      ]),
    ));

    const results = await Promise.all(lines.map(async (line): Promise<[string, LineSessionState]> => {
      try {
        const res = await fetch(`/api/lines/${line.id}/active-session`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error?.message || 'Gagal mengambil data sesi aktif');
        }

        const json = await res.json();
        return [line.id, { session: json.activeSession, loading: false, error: null }];
      } catch (err: unknown) {
        return [
          line.id,
          {
            session: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Terjadi kesalahan server',
          },
        ];
      }
    }));

    setSessionsByLine(Object.fromEntries(results));
  }, [lines]);

  useEffect(() => {
    fetchActiveSessions();

    const timer = setInterval(() => {
      fetchActiveSessions();
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchActiveSessions]);

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
      fetchActiveSessions();
    }
  }, [lastMessage, fetchActiveSessions]);

  const displayedLines = useMemo(() => {
    if (!urlLineId) return lines;

    return [...lines].sort((first, second) => {
      if (first.id === urlLineId) return -1;
      if (second.id === urlLineId) return 1;
      return 0;
    });
  }, [lines, urlLineId]);

  return (
    <div className="mx-auto max-w-400 space-y-6 pb-10">
      <PageHeader
        title="Penghitungan Admin"
        description="Pantau, selesaikan, atau batalkan sesi counting seluruh line secara bersamaan."
        actions={<StatusBadge tone="primary"><ShieldCheck />Akses penuh</StatusBadge>}
      />

      {linesLoading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <LoadingState label="Memuat informasi line pertama" rows={5} />
          <LoadingState label="Memuat informasi line kedua" rows={5} />
        </div>
      ) : linesError ? (
        <ErrorState description={linesError} onRetry={fetchLines} />
      ) : displayedLines.length > 0 ? (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {displayedLines.map((line) => {
            const lineState = sessionsByLine[line.id];
            const session = lineState?.session;
            const lineLoading = !lineState || lineState.loading;

            return (
              <section key={line.id} className="min-w-0 space-y-3" aria-labelledby={`counting-line-${line.id}`}>
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <h2 id={`counting-line-${line.id}`} className="truncate font-heading text-base font-medium">
                      {line.name}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">{line.lineCode}</p>
                  </div>
                  <StatusBadge tone={session ? 'warning' : 'neutral'}>
                    <Radio className={session ? 'animate-pulse' : ''} />
                    {lineLoading ? 'MEMUAT' : session ? 'COUNTING' : 'IDLE'}
                  </StatusBadge>
                </div>

                {lineLoading ? (
                  <LoadingState label={`Memuat informasi ${line.name}`} rows={5} />
                ) : lineState.error ? (
                  <ErrorState description={lineState.error} onRetry={fetchActiveSessions} />
                ) : session ? (
                  <CountingConsole
                    session={session}
                    isAdmin={true}
                    compact
                    onFinishSuccess={fetchActiveSessions}
                    onCancelSuccess={fetchActiveSessions}
                  />
                ) : (
                  <EmptyState
                    icon={Radio}
                    title={`${line.name} sedang tidak memiliki sesi aktif`}
                    description="Tidak ada proses penghitungan truck yang sedang berjalan di line ini."
                    action={
                      <Button asChild>
                        <Link href="/admin/receiving">
                          <PlayCircle className="size-4" />
                          <span>Buka manajemen Surat Jalan</span>
                        </Link>
                      </Button>
                    }
                  />
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Radio}
          title="Belum ada line yang tersedia"
          description="Tambahkan line terlebih dahulu melalui menu Line & Perangkat."
        />
      )}
    </div>
  );
}

export default function AdminCountingPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat halaman penghitungan Admin" rows={4} />}>
      <AdminCountingContent />
    </Suspense>
  );
}
