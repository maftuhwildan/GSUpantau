'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, RefreshCw, AlertCircle, RotateCcw, FileText, CheckCircle2, Scale, Radio, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateRangePicker, type DateOnlyRange } from '@/components/ui/date-picker';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PageHeader } from '@/components/layout/PageHeader';
import { getRecentReceivingChartData } from '@/lib/chart-data';
import { appendDateRangeParams } from '@/lib/ui-date';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LoadingState } from '@/components/ui/states';
import { useUrlFilters } from '@/lib/use-url-filters';

const receivingChartConfig = {
  manifest: { label: 'Manifest', color: 'var(--chart-1)' },
  actual: { label: 'Hasil Sensor', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Persistent URL Filters
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters({
    date_from: undefined,
    date_to: undefined,
    line_id: 'ALL',
  });

  const lineId = filters.line_id || 'ALL';
  const dateRange: DateOnlyRange = useMemo(
    () => ({
      from: filters.date_from || undefined,
      to: filters.date_to || undefined,
    }),
    [filters.date_from, filters.date_to]
  );

  const setDateRange = (range: DateOnlyRange) => {
    setFilters({
      date_from: range.from || undefined,
      date_to: range.to || undefined,
    });
  };

  const fetchLines = useCallback(async () => {
    try {
      const res = await fetch('/api/lines');
      if (res.ok) {
        const json = await res.json();
        setLines(json.lines || []);
      }
    } catch {
      // Ignore lines error
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const params = new URLSearchParams();
      appendDateRangeParams(params, dateRange);
      if (lineId && lineId !== 'ALL') params.append('line_id', lineId);

      const res = await fetch(`/api/reports?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data reports');

      setData(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [dateRange, lineId]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const hasActiveFilters = Boolean(dateRange.from || dateRange.to || lineId !== 'ALL');

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    appendDateRangeParams(params, dateRange);
    if (lineId && lineId !== 'ALL') params.append('line_id', lineId);
    params.append('format', 'csv');

    window.open(`/api/reports?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Operasional"
        description="Laporan penerimaan, hasil sensor vs manifest, dan efisiensi sensor."
        eyebrow="Admin"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="gap-1 min-h-[44px] sm:min-h-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} /> Muat ulang
            </Button>
            <Button size="sm" onClick={handleExportCSV} disabled={loading || !data} className="gap-1 min-h-[44px] sm:min-h-0">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </>
        }
      />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Interactive Filters Card */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="flex min-w-48 items-center gap-3 xl:self-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-medium text-foreground">Filter laporan</p>
              <p className="text-xs text-muted-foreground">Data diperbarui otomatis</p>
            </div>
          </div>

          <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-date-range" className="text-xs">Rentang tanggal</Label>
              <DateRangePicker
                id="report-date-range"
                value={dateRange}
                onValueChange={setDateRange}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-line" className="text-xs">Jalur</Label>
              <Select value={lineId} onValueChange={(val) => setFilter('line_id', val)}>
                <SelectTrigger id="report-line" className="h-11! w-full text-xs min-h-[44px] sm:min-h-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Jalur</SelectItem>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.lineCode} - {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={loading || !hasActiveFilters}
            className="h-11 w-full shrink-0 gap-1.5 xl:w-auto min-h-[44px] sm:min-h-0"
          >
            <RotateCcw className="size-3.5" /> Reset filter
          </Button>
        </CardContent>
      </Card>

      {loading && !data && (
        <LoadingState label="Memuat laporan" rows={4} />
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Manifest Selesai" value={(data.summary?.totalManifest || 0).toLocaleString('id-ID')} detail="Filter terpilih" icon={FileText} />
            <KpiCard label="Total Hasil Sensor" value={(data.summary?.totalActual || 0).toLocaleString('id-ID')} detail="Filter terpilih" icon={CheckCircle2} tone="success" />
            <KpiCard label="Variance (Selisih)" value={`${data.summary?.totalDifference > 0 ? '+' : ''}${(data.summary?.totalDifference || 0).toLocaleString('id-ID')}`} detail={`${data.summary?.totalDifferencePercent || 0}% Total`} icon={Scale} tone={data.summary?.totalDifference < 0 ? 'warning' : 'success'} />
            <KpiCard label="Kualitas Deteksi Sensor" value={`${(data.summary?.assignedDetections || 0).toLocaleString('id-ID')} / ${(data.summary?.unassignedDetections || 0).toLocaleString('id-ID')}`} detail="Terhubung Sesi / Tanpa Sesi" icon={Radio} tone="info" />
          </div>

          {getRecentReceivingChartData(data.list).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Manifest vs Hasil Sensor</CardTitle>
                <CardDescription>12 penerimaan terbaru dari hasil filter aktif.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={receivingChartConfig} className="h-[420px] w-full">
                  <BarChart accessibilityLayer data={getRecentReceivingChartData(data.list)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={88} tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(0, 12)} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.deliveryNoteNumber} • ${item.receivingDate} • ${item.licensePlateSnapshot}` : '';
                      }} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="manifest" fill="var(--color-manifest)" radius={4} />
                    <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Riwayat Penerimaan Selesai</CardTitle>
                  <CardDescription className="text-xs">
                    Daftar semua truk yang telah selesai dihitung sesuai filter.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  Total {data.list?.length || 0} Data
                </Badge>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {data.list?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-xs italic">
                    Belum ada data penerimaan selesai yang cocok dengan filter.
                  </p>
                ) : (
                  <>
                    {/* Mobile Cards View (< md) */}
                    <div className="divide-y divide-border md:hidden">
                      {data.list?.map((item: any) => {
                        const diff = item.differenceCount || 0;
                        const diffLabel = diff < 0 ? `Kurang (${diff.toLocaleString('id-ID')})` : diff > 0 ? `Lebih (+${diff.toLocaleString('id-ID')})` : 'Sesuai (0)';
                        return (
                          <div key={item.id} className="p-4 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {item.deliveryNoteNumber}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.receivingDate}
                              </Badge>
                            </div>

                            <div className="text-muted-foreground space-y-0.5">
                              <p><span className="font-medium text-foreground">{item.licensePlateSnapshot}</span> • Jalur: {item.line?.lineCode || item.line?.name || '—'}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center font-mono tabular-nums">
                              <div>
                                <span className="text-muted-foreground text-xs block font-sans">Manifest</span>
                                <span className="font-medium">{item.manifestCount.toLocaleString('id-ID')}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs block font-sans">Hasil Sensor</span>
                                <span className="font-medium text-primary">{item.actualCount.toLocaleString('id-ID')}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs block font-sans">Selisih ({item.differencePercent}%)</span>
                                <span className={`font-medium ${diff < 0 ? 'text-destructive' : diff > 0 ? 'text-primary' : 'text-foreground'}`}>
                                  {diffLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View (>= md) */}
                    <div className="hidden md:block rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead className="text-xs w-[120px]">Tanggal</TableHead>
                            <TableHead className="text-xs">No. SJ / Truk</TableHead>
                            <TableHead className="text-xs">Jalur</TableHead>
                            <TableHead className="text-xs text-right">Manifest</TableHead>
                            <TableHead className="text-xs text-right">Hasil Sensor</TableHead>
                            <TableHead className="text-xs text-right">Selisih</TableHead>
                            <TableHead className="text-xs text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.list?.map((item: any) => {
                            const diff = item.differenceCount || 0;
                            const diffText = diff < 0 ? `Kurang (${diff.toLocaleString('id-ID')})` : diff > 0 ? `Lebih (+${diff.toLocaleString('id-ID')})` : 'Sesuai (0)';
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs">{item.receivingDate}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-foreground">{item.deliveryNoteNumber}</div>
                                  <div className="text-xs text-muted-foreground">{item.licensePlateSnapshot}</div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="secondary">
                                    {item.line?.lineCode || item.line?.name || '-'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono tabular-nums">{item.manifestCount.toLocaleString('id-ID')}</TableCell>
                                <TableCell className="text-xs text-right font-mono tabular-nums text-primary">{item.actualCount.toLocaleString('id-ID')}</TableCell>
                                <TableCell className={`text-xs text-right font-mono tabular-nums font-medium ${diff < 0 ? 'text-destructive' : diff > 0 ? 'text-primary' : 'text-foreground'}`}>
                                  {diffText}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono tabular-nums">{item.differencePercent}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
