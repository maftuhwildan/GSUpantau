import { Activity, Filter, Cpu, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminSensorActivityPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Aktivitas Sensor Semua Line</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitoring deteksi sensor, sinyal heartbeat, dan event unik dari semua ESP32 secara terpusat.
          </p>
        </div>
        <Badge variant="outline" className="text-purple-700 bg-purple-50">
          Admin Monitoring
        </Badge>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Aliran Stream Event Sensor Terpusat</CardTitle>
          <CardDescription className="text-xs">
            Filter berdasarkan Line, Perangkat, Tipe Event, atau Status Assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Waktu Terima</th>
                  <th className="p-3">Line & Perangkat</th>
                  <th className="p-3">Sequence</th>
                  <th className="p-3">Tipe Event</th>
                  <th className="p-3">Assignment Status</th>
                  <th className="p-3">Session / Receiving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400">10:47:02</td>
                  <td className="p-3 font-semibold text-purple-700 dark:text-purple-400">Line 01 • ESP32-L01</td>
                  <td className="p-3 font-mono">1001</td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">DETECTION</td>
                  <td className="p-3"><Badge variant="success" className="text-[10px]">ASSIGNED</Badge></td>
                  <td className="p-3 text-foreground">SJ-2026-0807-002</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400">10:45:00</td>
                  <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Line 02 • ESP32-L02</td>
                  <td className="p-3 font-mono">-</td>
                  <td className="p-3 text-slate-400">HEARTBEAT</td>
                  <td className="p-3"><span className="text-slate-400">-</span></td>
                  <td className="p-3 text-slate-400">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
