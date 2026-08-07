import { Cpu, Radio, RefreshCw, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminLinesDevicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Line & Perangkat ESP32</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manajemen jalur fisik pemotongan dan registrasi perangkat keras sensor counter.
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
          <Plus className="h-4 w-4" />
          <span>Registrasi Perangkat ESP32 Baru</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Line 01 (Jalur Utama)</CardTitle>
              <Badge variant="success">ACTIVE</Badge>
            </div>
            <CardDescription className="text-xs">Physical line terhubung ke conveyor gantung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4" /> ESP32-LINE-01
                </span>
                <Badge variant="success" className="text-[10px] gap-1">
                  <Radio className="h-3 w-3 animate-pulse" /> ONLINE
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                <div>RSSI Wi-Fi: <strong className="text-foreground">-61 dBm</strong></div>
                <div>Firmware: <strong className="text-foreground">v1.0.0</strong></div>
                <div>Last Heartbeat: <strong className="text-foreground">3 detik lalu</strong></div>
                <div>Cred Hash: <strong className="text-foreground">sha256:8f2a...</strong></div>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-purple-300">
              <RefreshCw className="h-3.5 w-3.5 text-purple-600" />
              <span>Rotate Secret Kredensial Perangkat</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Line 02 (Jalur Cadangan)</CardTitle>
              <Badge variant="success">ACTIVE</Badge>
            </div>
            <CardDescription className="text-xs">Physical line cadangan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4" /> ESP32-LINE-02
                </span>
                <Badge variant="success" className="text-[10px] gap-1">
                  <Radio className="h-3 w-3 animate-pulse" /> ONLINE
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                <div>RSSI Wi-Fi: <strong className="text-foreground">-58 dBm</strong></div>
                <div>Firmware: <strong className="text-foreground">v1.0.0</strong></div>
                <div>Last Heartbeat: <strong className="text-foreground">5 detik lalu</strong></div>
                <div>Cred Hash: <strong className="text-foreground">sha256:3c1b...</strong></div>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-purple-300">
              <RefreshCw className="h-3.5 w-3.5 text-purple-600" />
              <span>Rotate Secret Kredensial Perangkat</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
