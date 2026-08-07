import Link from "next/link";
import {
  Truck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Layers,
  ArrowRight,
  Bird,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OperatorDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Line Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Dashboard Operator • Line 01
            </h1>
            <Badge variant="success">Sesi Aktif</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pantau status penghitungan truck penerimaan ayam secara realtime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/receiving-queue">
              <Layers className="h-4 w-4 text-purple-600" />
              <span>Lihat Antrean (3)</span>
            </Link>
          </Button>

          <Button size="sm" asChild className="bg-purple-600 hover:bg-purple-500 gap-1.5">
            <Link href="/active-session">
              <Play className="h-4 w-4" />
              <span>Buka Console Sesi Aktif</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Active Session Highlight */}
      <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 dark:from-card dark:to-purple-950/20 shadow-md">
        <CardHeader className="pb-3 border-b border-purple-100 dark:border-purple-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-600 text-white">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Truck Sedang Dihitung: B 9284 UYX
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  No. Surat Jalan: SJ-2026-0807-002 • Supplier: Farm Maju Bersama
                </CardDescription>
              </div>
            </div>
            <Badge variant="warning" className="animate-pulse">
              COUNTING
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Manifest Count */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Manifest (Surat Jalan)</p>
              <p className="text-3xl font-extrabold text-foreground mt-1">4,500</p>
              <p className="text-[10px] text-muted-foreground mt-1">Ekor Terdaftar</p>
            </div>

            {/* Actual Realtime Count */}
            <div className="p-4 rounded-xl bg-purple-600 text-white shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start">
                <p className="text-xs font-medium text-purple-100">Hitung Realtime (Sensor)</p>
                <Radio className="h-4 w-4 animate-pulse text-pink-300" />
              </div>
              <p className="text-3xl font-extrabold mt-1 tracking-tight">3,248</p>
              <p className="text-[10px] text-purple-200 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Deteksi terakhir: 2 dtk lalu
              </p>
            </div>

            {/* Temporary Difference */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Selisih Sementara</p>
              <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">-1,252</p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 font-medium">
                Proses Belum Selesai (-27.8%)
              </p>
            </div>

            {/* Sensor Status */}
            <div className="p-4 rounded-xl bg-white dark:bg-card border border-border shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status Sensor Line</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                    ONLINE (ESP32-L01)
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                RSSI: -62 dBm • Heartbeat OK
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="default" asChild className="bg-purple-600 hover:bg-purple-500 gap-2">
              <Link href="/active-session">
                <span>Kelola & Selesaikan Sesi</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Operational Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waiting Queue Summary */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Antrean Menunggu (Waiting Queue)</span>
              <Badge variant="secondary">3 Truck</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                no: "1",
                plate: "B 9812 KLL",
                sj: "SJ-2026-0807-003",
                supplier: "Farm Berkah Jaya",
                manifest: "5,000 ekor",
              },
              {
                no: "2",
                plate: "B 9102 POP",
                sj: "SJ-2026-0807-004",
                supplier: "Farm Sumber Ayam",
                manifest: "4,800 ekor",
              },
            ].map((item) => (
              <div
                key={item.no}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{item.plate}</span>
                    <span className="text-muted-foreground">({item.sj})</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-700 dark:text-purple-400">{item.manifest}</p>
                  <span className="text-[10px] text-slate-400">Siap Dihitung</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Operational Context & Diagnostics */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bird className="h-4 w-4 text-purple-600" />
              <span>Ringkasan Deteksi Hari Ini</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-muted-foreground font-medium">Assigned Deteksi</p>
                <p className="text-xl font-bold text-foreground mt-1">12,450</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Terhubung ke session
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <p className="text-amber-800 dark:text-amber-400 font-medium">Unassigned Deteksi</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-1">14</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Di luar sesi aktif
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-300 text-[11px] leading-relaxed">
              <strong>Aturan SOP Batas Truck:</strong> Pastikan truck yang sedang dihitung benar-benar selesai dan proses penggantungan berhenti sebelum menyelesaikan sesi agar deteksi berikutnya tidak menjadi <em>unassigned</em>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
