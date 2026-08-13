'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Truck,
  Layers,
  Activity,
  PlusCircle,
  Play,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Clock,
  Radio,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { DateRangePicker, type DateOnlyRange } from '@/components/ui/date-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTrendChartData } from '@/lib/chart-data';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminDashboardData, AdminDashboardLineOverview, AdminDashboardRecentReceiving } from '@/types/admin-dashboard';
import { getTodayStringInSiteTimezone, addCalendarDays } from '@/lib/time';

const trendChartConfig = {
  manifest: { label: 'Total Manifest', color: 'var(--chart-1)' },
  actual: { label: 'Actual (Tren)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type PeriodType = '7d' | '30d' | 'custom';

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Period filter state
  const [period, setPeriod] = useState<PeriodType>('7d');
  const todayStr = getTodayStringInSiteTimezone();
  const [customRange, setCustomRange] = useState<DateOnlyRange>({
    from: addCalendarDays(todayStr, -6),
    to: todayStr,
  });

  const { lastMessage } = useWebSocket();

  // Fetch Dashboard API with selected date parameters
  const fetchDashboard = useCallback(async (dateFrom?: string, dateTo?: string) => {
    try {
      setLoading(true);
      setErrorMsg('');

      let url = '/api/dashboard/admin';
      if (dateFrom && dateTo) {
        url += `?date_from=${dateFrom}&date_to=${dateTo}`;
      }

      const res = await fetch(url);
      const result = await res.json();

      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data dashboard');

      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute active date range based on period
  const getActiveDateRange = useCallback((): { from: string; to: string } => {
    const today = getTodayStringInSiteTimezone();
    if (period === '7d') {
      return { from: addCalendarDays(today, -6), to: today };
    }
    if (period === '30d') {
      return { from: addCalendarDays(today, -29), to: today };
    }
    return {
      from: customRange.from || addCalendarDays(today, -6),
      to: customRange.to || today,
    };
  }, [period, customRange]);

  // Trigger fetch when period or customRange changes
  useEffect(() => {
    const range = getActiveDateRange();
    fetchDashboard(range.from, range.to);
  }, [getActiveDateRange, fetchDashboard]);

  // Handle WebSocket updates while keeping selected period
  useEffect(() => {
    if (lastMessage) {
      const type = (lastMessage as { type?: string }).type;
      if (
        type === 'session.started' ||
        type === 'session.finished' ||
        type === 'session.cancelled' ||
        type === 'receiving.queue_updated' ||
        type === 'session.counter_updated' ||
        type === 'device.heartbeat_received' ||
        type === 'device.status_updated' ||
        type === 'audit.created' ||
        type === 'realtime.reconnected' ||
        type === 'realtime.poll'
      ) {
        const range = getActiveDateRange();
        fetchDashboard(range.from, range.to);
      }
    }
  }, [lastMessage, fetchDashboard, getActiveDateRange]);

  if (loading && !data) {
    return <LoadingState label="Memuat Dashboard Administrator" rows={5} />;
  }

  if (errorMsg && !data) {
    return <ErrorState description={errorMsg} onRetry={() => {
      const range = getActiveDateRange();
      fetchDashboard(range.from, range.to);
    }} />;
  }

  if (!data) return null;

  // Format device status badge tone
  const deviceStatusTone = (status?: string): StatusTone => {
    if (status === 'ONLINE') return 'success';
    if (status === 'DEGRADED') return 'warning';
    if (status === 'OFFLINE') return 'danger';
    if (status === 'MAINTENANCE') return 'warning';
    return 'neutral';
  };

  const trendChartData = getTrendChartData(data.trend || []);
  const hasCompletedInPeriod = (data.trend || []).some((t) => t.completedReceivingCount > 0);

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header Ringkas */}
      <PageHeader
        title="Dashboard Administrator"
        description="Ringkasan eksekutif operasional harian penerimaan ayam, kesehatan jalur, dan analitik."
        actions={
          <>
            <Button asChild className="gap-2">
              <Link href="/admin/receiving">
                <PlusCircle className="size-4" />
                <span>Input Surat Jalan</span>
              </Link>
            </Button>

            <Button variant="outline" asChild className="gap-2">
              <Link href="/admin/counting">
                <Play className="size-4 text-primary" />
                <span>Buka Counting</span>
              </Link>
            </Button>
          </>
        }
      />

      {/* 2. Hero Operasional Hari Ini */}
      <Card className="overflow-hidden border-border bg-card shadow-xs">
        <div className="border-b border-border bg-muted/30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operasional Hari Ini
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone="info" className="text-xs">
              <ShieldCheck className="size-3" />
              {data.activeLinesCount} dari {data.linesOverview.length} Line Aktif
            </StatusBadge>
            <span className="text-xs text-muted-foreground tabular-nums">
              Antrean Waiting: <strong className="text-foreground font-semibold">{data.waitingQueueCount}</strong> Truck
            </span>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Metric 1: Total Manifest */}
            <div className="space-y-1 sm:pr-4 first:pt-0 pt-4 sm:pt-0">
              <span className="text-xs font-medium text-muted-foreground">Total Manifest Hari Ini</span>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                  {data.totalManifestToday.toLocaleString('id-ID')}
                </p>
                <span className="text-xs font-medium text-muted-foreground">ekor</span>
              </div>
              <p className="text-xs text-muted-foreground">Semua surat jalan terdaftar</p>
            </div>

            {/* Metric 2: Actual Selesai */}
            <div className="space-y-1 sm:px-4 pt-4 sm:pt-0">
              <span className="text-xs font-medium text-muted-foreground">Actual Selesai Hari Ini</span>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-primary">
                  {data.actualCompletedToday.toLocaleString('id-ID')}
                </p>
                <span className="text-xs font-medium text-muted-foreground">ekor</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {data.completedReceivingCount} Truck Selesai Dihitung
              </p>
            </div>

            {/* Metric 3: Truck Selesai */}
            <div className="space-y-1 sm:px-4 pt-4 sm:pt-0">
              <span className="text-xs font-medium text-muted-foreground">Truck Selesai Hari Ini</span>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                  {data.completedReceivingCount}
                </p>
                <span className="text-xs font-medium text-muted-foreground">truck</span>
              </div>
              <p className="text-xs text-muted-foreground">Status sesi COMPLETED</p>
            </div>

            {/* Metric 4: Selisih Akhir */}
            <div className="space-y-1 sm:pl-4 pt-4 sm:pt-0">
              <span className="text-xs font-medium text-muted-foreground">Selisih Akhir (Final Variance)</span>
              {data.completedReceivingCount > 0 ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <p className={`text-3xl font-semibold tracking-tight tabular-nums ${
                      data.finalDifferenceCount < 0 ? 'text-destructive' : 'text-primary'
                    }`}>
                      {data.finalDifferenceCount > 0 ? '+' : ''}
                      {data.finalDifferenceCount.toLocaleString('id-ID')}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">ekor</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge
                      tone={data.finalDifferenceCount < 0 ? 'warning' : 'success'}
                      className="text-xs py-0 px-1.5"
                    >
                      {data.finalDifferencePercent > 0 ? '+' : ''}
                      {data.finalDifferencePercent}%
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">dari manifest selesai</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground">
                    —
                  </p>
                  <p className="text-xs text-muted-foreground italic">Belum ada sesi selesai</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Operational Alerts Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alert 1: Deteksi Unassigned */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg shrink-0 ${
                data.unassignedDetectionsToday > 0
                  ? 'bg-warning/15 text-warning-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Radio className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Deteksi Unassigned Hari Ini</span>
                  <StatusBadge tone={data.unassignedDetectionsToday > 0 ? 'warning' : 'neutral'}>
                    {data.unassignedDetectionsToday > 0
                      ? `${data.unassignedDetectionsToday} Perlu Disemak`
                      : '0 Deteksi • Aman'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sensor mendeteksi ayam saat tidak ada sesi counting aktif.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1 text-xs">
              <Link href="/admin/sensor-activity">
                <span>Lihat Stream</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Alert 2: Perlu Review */}
        <Card className="border border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg shrink-0 ${
                data.reviewRequiredCount > 0
                  ? 'bg-warning/15 text-warning-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <AlertCircle className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Penerimaan Perlu Review</span>
                  <StatusBadge tone={data.reviewRequiredCount > 0 ? 'warning' : 'neutral'}>
                    {data.reviewRequiredCount > 0
                      ? `${data.reviewRequiredCount} Perlu Review`
                      : '0 Receiving • Sesuai'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Terdapat selisih signifikan yang membutuhkan verifikasi Admin.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1 text-xs">
              <Link href="/admin/reports">
                <span>Buka Laporan</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4–5. Status Line & Analitik (berdampingan pada desktop lebar) */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
      {/* 4. Status Line Section */}
      <Card className="min-w-0 h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Status Operational Line</CardTitle>
            <CardDescription className="text-xs">
              Kondisi real-time setiap jalur counting, status perangkat sensor, dan sesi berjalan.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {data.linesOverview.length} Jalur Terdaftar
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {data.linesOverview.map((item: AdminDashboardLineOverview) => {
            const hasActiveSession = Boolean(item.activeSession);
            const manifest = item.activeSession?.receiving?.manifestCount || 0;
            const actual = item.activeSession?.actualCount || 0;
            const diff = actual - manifest;
            const progressPercent = manifest > 0 ? Math.min(100, Math.max(0, Math.round((actual / manifest) * 100))) : 0;

            return (
              <div
                key={item.line.id}
                className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80"
              >
                {/* Line Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-foreground">{item.line.name}</span>
                    <span className="text-xs text-muted-foreground">({item.line.lineCode})</span>
                    {hasActiveSession ? (
                      <StatusBadge tone="warning" className="animate-pulse">
                        <Activity className="size-3" />
                        COUNTING
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">IDLE</StatusBadge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {/* Device Status */}
                    {item.device ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Perangkat ({item.device.deviceCode}):</span>
                        <StatusBadge tone={deviceStatusTone(item.device.status)}>
                          {item.device.status}
                        </StatusBadge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Belum ada sensor</span>
                    )}

                    {/* Waiting queue for line */}
                    <Badge variant="secondary" className="text-xs font-normal">
                      {item.waitingQueueCount} truck waiting
                    </Badge>

                    {/* Action Deep Link */}
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                      <Link href={`/admin/counting?line_id=${item.line.id}`}>
                        <span>Buka Line</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Line Details Row */}
                {hasActiveSession && item.activeSession ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Truck / SJ:</span>
                        <p className="font-semibold text-foreground truncate">
                          {item.activeSession.receiving?.licensePlateSnapshot || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.activeSession.receiving?.deliveryNoteNumber}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Manifest:</span>
                        <p className="font-semibold tabular-nums text-foreground">
                          {manifest.toLocaleString('id-ID')} ekor
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Actual Realtime:</span>
                        <p className="font-semibold tabular-nums text-primary">
                          {actual.toLocaleString('id-ID')} ekor
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Selisih Sementara:</span>
                        <div className="flex items-center gap-1">
                          <p className={`font-semibold tabular-nums ${diff < 0 ? 'text-destructive' : 'text-primary'}`}>
                            {diff > 0 ? '+' : ''}{diff.toLocaleString('id-ID')} ekor
                          </p>
                          <span className="text-xs text-muted-foreground italic">(Belum final)</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress Sesi</span>
                        <span className="tabular-nums font-medium text-foreground">{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <p className="italic">Jalur ini sedang idle (tidak ada sesi penghitungan aktif).</p>
                  </div>
                )}

                {/* Heartbeat & Last Detection Info Footer */}
                <div className="mt-3 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                  <span>
                    Heartbeat Terakhir:{' '}
                    <strong className="text-foreground font-medium">
                      {item.device?.lastHeartbeatAt
                        ? new Date(item.device.lastHeartbeatAt).toLocaleTimeString('id-ID')
                        : 'Belum ada'}
                    </strong>
                  </span>
                  <span>
                    Deteksi Terakhir:{' '}
                    <strong className="text-foreground font-medium">
                      {item.lastDetectionAt
                        ? new Date(item.lastDetectionAt).toLocaleTimeString('id-ID')
                        : 'Belum ada'}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 5. Analitik Manifest vs Actual */}
      <Card className="min-w-0 h-full">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Analitik Manifest vs Actual
            </CardTitle>
            <CardDescription className="text-xs">
              Perbandingan total manifest dan actual sensor dari penerimaan yang telah selesai (COMPLETED).
            </CardDescription>
          </div>

          {/* Period Selector Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(val) => {
                if (val) setPeriod(val as PeriodType);
              }}
              variant="outline"
              size="sm"
              aria-label="Pilih periode analitik"
            >
              <ToggleGroupItem value="7d" className="text-xs px-2.5">
                7 Hari
              </ToggleGroupItem>
              <ToggleGroupItem value="30d" className="text-xs px-2.5">
                30 Hari
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="text-xs px-2.5">
                Kustom
              </ToggleGroupItem>
            </ToggleGroup>

            {period === 'custom' && (
              <div className="w-full sm:w-auto min-w-[240px]">
                <DateRangePicker
                  value={customRange}
                  onValueChange={(range) => {
                    if (range.from && range.to) {
                      setCustomRange(range);
                    }
                  }}
                  placeholder="Pilih rentang tanggal"
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!hasCompletedInPeriod ? (
            <EmptyState
              icon={Activity}
              title="Belum ada penerimaan selesai"
              description="Chart akan menampilkan perbandingan manifest dan actual ketika terdapat penerimaan berstatus COMPLETED pada periode terpilih."
            />
          ) : (
            <ChartContainer config={trendChartConfig} className="h-[320px] w-full">
              <ComposedChart accessibilityLayer data={trendChartData} margin={{ left: 8, right: 8, top: 12 }}>
                <defs>
                  <linearGradient id="actualTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-actual)" stopOpacity={0.9} />
                    <stop offset="65%" stopColor="var(--color-actual)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-actual)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="manifest" fill="var(--color-manifest)" radius={4} zIndex={300} />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="none"
                  fill="url(#actualTrendFill)"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  tooltipType="none"
                  zIndex={350}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--color-actual)"
                  strokeWidth={2.5}
                  fill="none"
                  dot={{ r: 3, fill: 'var(--color-actual)' }}
                  activeDot={{ r: 5 }}
                  zIndex={400}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      </div>

      {/* 6. Aktivitas Sekunder (2 Columns on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Receivings Table (2 cols on lg) */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Receiving Terbaru</CardTitle>
                <CardDescription className="text-xs">
                  Lima dokumen penerimaan terbaru yang telah diinputkan.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs gap-1 text-primary">
                <Link href="/admin/receiving">
                  <span>Lihat semua</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-0 flex-1">
              {data.recentReceivings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-8">
                  Belum ada data penerimaan terdaftar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">No. Surat Jalan</TableHead>
                        <TableHead className="text-xs">Supplier / Truck</TableHead>
                        <TableHead className="text-xs">Jalur</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Manifest vs Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentReceivings.map((rec: AdminDashboardRecentReceiving) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-medium text-xs">
                            <p className="text-foreground">{rec.deliveryNoteNumber}</p>
                            <p className="text-xs text-muted-foreground">{rec.receivingNumber}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p className="text-foreground font-medium">{rec.supplierNameSnapshot}</p>
                            <p className="text-xs text-muted-foreground">{rec.licensePlateSnapshot}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {rec.line?.name || '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <StatusBadge
                              tone={
                                rec.status === 'COMPLETED'
                                  ? 'success'
                                  : rec.status === 'COUNTING'
                                  ? 'warning'
                                  : rec.status === 'CANCELLED'
                                  ? 'danger'
                                  : 'neutral'
                              }
                            >
                              {rec.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            <p className="font-medium text-foreground">
                              {rec.manifestCount.toLocaleString('id-ID')} ekor
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {rec.actualCount !== null
                                ? `Actual: ${rec.actualCount.toLocaleString('id-ID')} ekor`
                                : 'Belum dihitung'}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Audit Trail Activity (1 col on lg) */}
        <div>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  <span>Aktivitas Audit</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Log aktivitas sistem immutable terbaru.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs gap-1 text-primary">
                <Link href="/admin/audit-trail">
                  <span>Lihat semua</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="divide-y divide-border text-xs">
                {data.recentAuditLogs.length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-6">Belum ada log audit.</p>
                ) : (
                  data.recentAuditLogs.map((log) => (
                    <div key={log.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground">{log.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Entitas: <strong className="text-foreground font-normal">{log.entityType}</strong> ({log.entityId.substring(0, 8)}...)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Oleh: {log.actor?.email || 'System'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
