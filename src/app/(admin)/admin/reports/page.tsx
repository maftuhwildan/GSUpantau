'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, AlertCircle, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/reports');
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || 'Gagal mengambil data reports');
      
      setData(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Laporan Operasional</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Laporan penerimaan, actual vs manifest, dan efisiensi sensor.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReports} className="text-xs gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && !data && (
        <div className="p-12 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Memuat laporan...</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Manifest Selesai</p>
                <p className="text-2xl font-bold text-foreground mt-1">{(data.summary.totalManifest || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Semua waktu</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Actual Dihitung</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{(data.summary.totalActual || 0).toLocaleString()}</p>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Semua waktu</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Variance (Selisih)</p>
                <p className={`text-2xl font-bold mt-1 ${data.summary.totalDifference < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {data.summary.totalDifference > 0 ? '+' : ''}{(data.summary.totalDifference || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.summary.totalDifferencePercent || 0}% Total</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Kualitas Deteksi</p>
                <div className="flex justify-between items-center mt-1">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">{data.summary.assignedDetections.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Assigned</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-600">{data.summary.unassignedDetections.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Unassigned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Riwayat Penerimaan Selesai</CardTitle>
              <CardDescription className="text-xs">
                Daftar semua truck yang telah selesai dihitung.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">Tanggal</TableHead>
                      <TableHead className="text-xs">No. SJ / Truck</TableHead>
                      <TableHead className="text-xs text-right">Manifest</TableHead>
                      <TableHead className="text-xs text-right">Actual</TableHead>
                      <TableHead className="text-xs text-right">Selisih</TableHead>
                      <TableHead className="text-xs text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.list?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          Belum ada data penerimaan selesai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.list?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{item.receivingDate}</TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">{item.deliveryNoteNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{item.licensePlateSnapshot}</div>
                          </TableCell>
                          <TableCell className="text-xs text-right">{item.manifestCount.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-emerald-600">{item.actualCount.toLocaleString()}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${item.differenceCount < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {item.differenceCount > 0 ? '+' : ''}{item.differenceCount.toLocaleString()}
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
