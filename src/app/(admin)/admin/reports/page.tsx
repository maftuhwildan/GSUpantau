'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
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
  }, [dateFrom, dateTo, lineId]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setLineId('ALL');
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (lineId && lineId !== 'ALL') params.append('line_id', lineId);
    params.append('format', 'csv');

    window.open(`/api/reports?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Laporan Operasional</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Laporan penerimaan, actual vs manifest, dan efisiensi sensor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="text-xs gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={handleExportCSV} disabled={loading || !data} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interactive Filters Card */}
      <Card className="border-border p-4">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal Dari</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal Sampai</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Jalur (Line)</label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lineCode} - {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={loading} className="h-9 text-xs gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {loading && !data && (
        <div className="p-12 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-600" />
          <p className="text-sm font-medium">Memuat laporan...</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Manifest Selesai</p>
                <p className="text-2xl font-bold text-foreground mt-1">{(data.summary?.totalManifest || 0).toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Filter Terpilih</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Actual Dihitung</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{(data.summary?.totalActual || 0).toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Filter Terpilih</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Variance (Selisih)</p>
                <p className={`text-2xl font-bold mt-1 ${data.summary?.totalDifference < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {data.summary?.totalDifference > 0 ? '+' : ''}{(data.summary?.totalDifference || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.summary?.totalDifferencePercent || 0}% Total</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Kualitas Deteksi Sensor</p>
                <div className="flex justify-between items-center mt-1">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">{(data.summary?.assignedDetections || 0).toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-muted-foreground">Assigned</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-600">{(data.summary?.unassignedDetections || 0).toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-muted-foreground">Unassigned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Riwayat Penerimaan Selesai</CardTitle>
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
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
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
                            <div className="font-medium text-xs text-foreground">{item.deliveryNoteNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{item.licensePlateSnapshot}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px]">
                              {item.line?.lineCode || item.line?.name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">{item.manifestCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">{item.actualCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${item.differenceCount < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.differenceCount > 0 ? '+' : ''}{item.differenceCount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-xs text-right">{item.differencePercent}%</TableCell>
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
