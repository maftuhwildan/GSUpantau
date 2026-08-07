import Link from "next/link";
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
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard Administrator</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ringkasan menyeluruh penerimaan ayam, performa line, sensor, dan log audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="bg-purple-600 hover:bg-purple-500 gap-1.5 text-xs">
            <Link href="/admin/receiving">
              <PlusCircle className="h-4 w-4" />
              <span>Input Surat Jalan Baru</span>
            </Link>
          </Button>

          <Button variant="outline" asChild className="gap-1.5 text-xs border-purple-300">
            <Link href="/admin/counting">
              <Play className="h-4 w-4 text-purple-600" />
              <span>Buka Console Counting</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Manifest Hari Ini</p>
              <p className="text-2xl font-bold text-foreground mt-1">19,500</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">dari 4 Truck</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Actual Selesai Hari Ini</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">14,988</p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">3 Truck Selesai</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Selisih Akhir (Final)</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">-12</p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> -0.08% Variance
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Status Line & Sensor</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">2 / 2 Line</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Semua Perangkat Normal</p>
            </div>
            <div className="p-3 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Lines Overview & Recent Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line Status & Queue */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Status Operational Line</span>
                <Badge variant="outline">2 Active Lines</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Line 01 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">Line 01 (Utama)</span>
                    <Badge variant="warning" className="animate-pulse text-[10px]">COUNTING</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">ESP32-LINE-01 • RSSI -61dBm</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Truck Aktif:</span>
                    <p className="font-bold text-purple-700 dark:text-purple-400">B 9284 UYX</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Manifest:</span>
                    <p className="font-bold text-foreground">4,500 ekor</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual Sensor:</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">3,248 ekor</p>
                  </div>
                </div>
              </div>

              {/* Line 02 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">Line 02 (Cadangan)</span>
                    <Badge variant="secondary" className="text-[10px]">IDLE</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">ESP32-LINE-02 • RSSI -58dBm</span>
                </div>
                <p className="text-xs text-muted-foreground italic">Tidak ada sesi penghitungan aktif.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Recent Audit Activity */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-purple-600" />
                <span>Audit Trail Terbaru</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Aktivitas penting sistem tercatat immutable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                {[
                  { actor: "admin@local.test", action: "PUBLISH_RECEIVING", target: "SJ-2026-0807-003", time: "10:14 WIB" },
                  { actor: "operator@local.test", action: "START_SESSION", target: "Line 01 / B 9284 UYX", time: "10:15 WIB" },
                  { actor: "admin@local.test", action: "CREATE_RECEIVING", target: "SJ-2026-0807-004", time: "09:50 WIB" },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-purple-700 dark:text-purple-400">{item.action}</span>
                      <span className="text-slate-400">{item.time}</span>
                    </div>
                    <p className="text-foreground font-medium">{item.target}</p>
                    <p className="text-[10px] text-muted-foreground">Oleh: {item.actor}</p>
                  </div>
                ))}
              </div>

              <Button variant="ghost" size="sm" asChild className="w-full mt-4 text-xs gap-1 text-purple-600">
                <Link href="/admin/audit-trail">
                  <span>Lihat Semua Audit Log</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
