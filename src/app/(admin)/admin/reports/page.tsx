'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, RotateCcw, FileText, CheckCircle2, Scale, Radio } from 'lucide-react';
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

const receivingChartConfig = {
  manifest: { label: 'Manifest', color: 'var(--chart-1)' },
  actual: { label: 'Actual', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter States
  const [dateRange, setDateRange] = useState<DateOnlyRange>({});
  const [lineId, setLineId] = useState('ALL');

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

  const handleResetFilters = () => {
    setDateRange({});
    setLineId('ALL');
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    appendDateRangeParams(params, dateRange);
    if (lineId && lineId !== 'ALL') params.append('line_id', lineId);
    params.append('format', 'csv');

    window.open(`/api/reports?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Operasional" description="Laporan penerimaan, actual vs manifest, dan efisiensi sensor." actions={<>
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={handleExportCSV} disabled={loading || !data} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </>} />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Interactive Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full">
            <div>
              <Label htmlFor="report-date-range">Rentang Tanggal</Label>
              <DateRangePicker
                id="report-date-range"
                value={dateRange}
                onValueChange={setDateRange}
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="report-line">Jalur (Line)</Label>
              <Select value={lineId} onValueChange={setLineId}><SelectTrigger id="report-line" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Semua Line</SelectItem>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.lineCode} - {l.name}
                  </SelectItem>
                ))}
              </SelectContent></Select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={loading} className="h-9 gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {loading && !data && (
        <LoadingState label="Memuat laporan" rows={4} />
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Manifest Selesai" value={(data.summary?.totalManifest || 0).toLocaleString('id-ID')} detail="Filter terpilih" icon={FileText} />
            <KpiCard label="Total Actual Dihitung" value={(data.summary?.totalActual || 0).toLocaleString('id-ID')} detail="Filter terpilih" icon={CheckCircle2} tone="success" />
            <KpiCard label="Variance (Selisih)" value={`${data.summary?.totalDifference > 0 ? '+' : ''}${(data.summary?.totalDifference || 0).toLocaleString('id-ID')}`} detail={`${data.summary?.totalDifferencePercent || 0}% Total`} icon={Scale} tone={data.summary?.totalDifference < 0 ? 'warning' : 'success'} />
            <KpiCard label="Kualitas Deteksi Sensor" value={`${(data.summary?.assignedDetections || 0).toLocaleString('id-ID')} / ${(data.summary?.unassignedDetections || 0).toLocaleString('id-ID')}`} detail="Assigned / Unassigned" icon={Radio} tone="info" />
          </div>

          {getRecentReceivingChartData(data.list).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Manifest vs Actual</CardTitle>
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
                  Daftar semua truck yang telah selesai dihitung sesuai filter.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                Total {data.list?.length || 0} Data
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted ">
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">Tanggal</TableHead>
                      <TableHead className="text-xs">No. SJ / Truck</TableHead>
                      <TableHead className="text-xs">Line</TableHead>
                      <TableHead className="text-xs text-right">Manifest</TableHead>
                      <TableHead className="text-xs text-right">Actual</TableHead>
                      <TableHead className="text-xs text-right">Selisih</TableHead>
                      <TableHead className="text-xs text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.list?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                          Belum ada data penerimaan selesai yang cocok dengan filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.list?.map((item: any) => (
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
                          <TableCell className="text-xs text-right font-normal tabular-nums">{item.manifestCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-xs text-right font-normal tabular-nums text-success">{item.actualCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className={`text-xs text-right font-normal tabular-nums ${item.differenceCount < 0 ? 'text-warning-foreground' : 'text-success'}`}>
                            {item.differenceCount > 0 ? '+' : ''}{item.differenceCount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-xs text-right font-normal tabular-nums">{item.differencePercent}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
