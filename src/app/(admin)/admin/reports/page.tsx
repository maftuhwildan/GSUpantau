import { FileSpreadsheet, Download, Filter, TrendingDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Laporan Operasional (Operational Reports)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Rekap perbandingan Manifest vs Actual hitungan sensor, variansi selisih ekor, dan persentase per periode.
          </p>
        </div>
        <Button variant="outline" className="text-xs gap-1.5 border-purple-300">
          <Download className="h-4 w-4 text-purple-600" />
          <span>Export Excel / CSV</span>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Rekap Penerimaan Truck Hari Ini</CardTitle>
          <CardDescription className="text-xs">
            Variance % = (Actual - Manifest) / Manifest * 100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Tanggal / Selesai</th>
                  <th className="p-3">No. Surat Jalan</th>
                  <th className="p-3">Plat Truck</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Manifest</th>
                  <th className="p-3 text-right">Actual Sensor</th>
                  <th className="p-3 text-right">Selisih (Ekor)</th>
                  <th className="p-3 text-right">Selisih (%)</th>
                  <th className="p-3 text-center">Status Rekon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="p-3 text-slate-500">07 Aug 2026 09:45</td>
                  <td className="p-3 font-semibold text-foreground">SJ-2026-0807-001</td>
                  <td className="p-3 font-bold text-purple-700 dark:text-purple-400">B 9001 AAA</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">Farm Poultry Prima</td>
                  <td className="p-3 text-right font-bold">5,200</td>
                  <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">5,198</td>
                  <td className="p-3 text-right font-bold text-amber-600">-2</td>
                  <td className="p-3 text-right font-semibold text-amber-600">-0.04%</td>
                  <td className="p-3 text-center"><Badge variant="success" className="text-[10px]">MATCHED</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
