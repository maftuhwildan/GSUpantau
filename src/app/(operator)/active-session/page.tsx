'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CountingConsole, ActiveSessionDetail } from '@/components/receiving/counting-console';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, AlertCircle, PlayCircle, Layers } from 'lucide-react';
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
      {/* Header & Line Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Console Penghitungan Sesi Aktif</h1>
            {sessionDetail ? (
              <Badge variant="warning" className="animate-pulse">COUNTING</Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500">IDLE / SIAP</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Console operasional utama untuk memantau hitungan sensor ESP32 dan menyelesaikan sesi.
          </p>
        </div>

        {/* Line Selector Pills */}
        {lines.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg border">
            <Layers className="h-4 w-4 text-slate-500 ml-1.5" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Jalur:</span>
            <div className="flex gap-1">
              {lines.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLineId(l.id)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedLineId === l.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading && !sessionDetail ? (
        <Card className="p-12 text-center text-xs text-muted-foreground">
          Memuat informasi sesi aktif...
        </Card>
      ) : error ? (
        <Card className="p-6 border-red-200 bg-red-50 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchActiveSession}>
            Coba Lagi
          </Button>
        </Card>
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
        /* Empty State when line is IDLE */
        <Card className="border-dashed border-2 p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
            <Radio className="h-6 w-6 text-purple-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Jalur Ini Sedang Tidak Memiliki Sesi Aktif</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Tidak ada proses penghitungan truk yang sedang berjalan di jalur ini. Silakan mulai sesi dari antrean Surat Jalan yang tersedia.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-2">
              <Link href="/operator/receiving-queue">
                <PlayCircle className="h-4 w-4" />
                <span>Pilih dari Antrean Surat Jalan</span>
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
